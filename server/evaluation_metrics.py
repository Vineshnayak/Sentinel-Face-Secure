"""
FAR/FRR Evaluation Module
Calculates False Acceptance Rate (FAR) and False Rejection Rate (FRR)
for facial authentication system evaluation
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime
from database import Database, USERS_COLLECTION, LOGS_COLLECTION
from cnn_embedding import CNNEmbeddingExtractor
from encryption import decrypt_embedding


@dataclass
class EvaluationResult:
    """Evaluation metrics result"""
    threshold: float
    far: float  # False Acceptance Rate
    frr: float  # False Rejection Rate
    accuracy: float
    true_positives: int
    true_negatives: int
    false_positives: int
    false_negatives: int
    total_genuine_attempts: int
    total_impostor_attempts: int


class FARFRREvaluator:
    """Evaluate FAR and FRR metrics"""
    
    def __init__(self, embedding_extractor: CNNEmbeddingExtractor):
        self.embedding_extractor = embedding_extractor
    
    async def get_user_embeddings(self) -> Dict[str, np.ndarray]:
        """Get all user embeddings from database"""
        db = Database.get_db()
        users_collection = db[USERS_COLLECTION]
        
        users = await users_collection.find({}).to_list(length=1000)
        embeddings = {}
        
        for user in users:
            embedding_data = user.get("embedding")
            if embedding_data is None:
                continue
            
            try:
                if isinstance(embedding_data, str):
                    decrypted = decrypt_embedding(embedding_data)
                    embedding = np.frombuffer(decrypted, dtype=np.float32)
                else:
                    embedding = np.array(embedding_data)
                
                # Normalize embedding
                norm = np.linalg.norm(embedding)
                if norm > 0:
                    embedding = embedding / norm
                
                embeddings[str(user["_id"])] = embedding
            except Exception:
                continue
        
        return embeddings
    
    async def get_authentication_logs(self) -> List[Dict]:
        """Get authentication logs for evaluation"""
        db = Database.get_db()
        logs_collection = db[LOGS_COLLECTION]
        
        logs = await logs_collection.find({
            "status": {"$in": ["success", "failed"]}
        }).sort("timestamp", -1).to_list(length=10000)
        
        return logs
    
    def calculate_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Calculate cosine similarity between embeddings"""
        dot_product = np.dot(emb1, emb2)
        norm1 = np.linalg.norm(emb1)
        norm2 = np.linalg.norm(emb2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        similarity = dot_product / (norm1 * norm2)
        return max(0.0, min(1.0, similarity))
    
    async def evaluate_far_frr(
        self, 
        threshold: float = 0.75,
        use_logs: bool = True
    ) -> EvaluationResult:
        """
        Evaluate FAR and FRR at a given threshold
        
        Args:
            threshold: Similarity threshold for authentication
            use_logs: Whether to use historical logs or generate test pairs
            
        Returns:
            EvaluationResult with FAR, FRR, and other metrics
        """
        user_embeddings = await self.get_user_embeddings()
        
        if len(user_embeddings) < 2:
            return EvaluationResult(
                threshold=threshold,
                far=0.0,
                frr=0.0,
                accuracy=0.0,
                true_positives=0,
                true_negatives=0,
                false_positives=0,
                false_negatives=0,
                total_genuine_attempts=0,
                total_impostor_attempts=0
            )
        
        if use_logs:
            return await self._evaluate_from_logs(user_embeddings, threshold)
        else:
            return await self._evaluate_from_pairs(user_embeddings, threshold)
    
    async def _evaluate_from_logs(
        self, 
        user_embeddings: Dict[str, np.ndarray],
        threshold: float
    ) -> EvaluationResult:
        """Evaluate using historical authentication logs"""
        logs = await self.get_authentication_logs()
        
        true_positives = 0
        true_negatives = 0
        false_positives = 0
        false_negatives = 0
        
        genuine_attempts = 0
        impostor_attempts = 0
        
        for log in logs:
            user_id = log.get("userId")
            status = log.get("status")
            confidence_str = log.get("confidence", "0.0")
            
            try:
                confidence = float(confidence_str)
            except:
                continue
            
            if user_id and user_id in user_embeddings:
                # Genuine attempt
                genuine_attempts += 1
                if status == "success" and confidence >= threshold:
                    true_positives += 1
                elif status == "success" and confidence < threshold:
                    false_negatives += 1
                elif status == "failed" and confidence >= threshold:
                    false_positives += 1
                elif status == "failed" and confidence < threshold:
                    true_negatives += 1
            else:
                # Impostor attempt
                impostor_attempts += 1
                if confidence >= threshold:
                    false_positives += 1
                else:
                    true_negatives += 1
        
        # Calculate metrics
        far = false_positives / impostor_attempts if impostor_attempts > 0 else 0.0
        frr = false_negatives / genuine_attempts if genuine_attempts > 0 else 0.0
        
        total = true_positives + true_negatives + false_positives + false_negatives
        accuracy = (true_positives + true_negatives) / total if total > 0 else 0.0
        
        return EvaluationResult(
            threshold=threshold,
            far=far,
            frr=frr,
            accuracy=accuracy,
            true_positives=true_positives,
            true_negatives=true_negatives,
            false_positives=false_positives,
            false_negatives=false_negatives,
            total_genuine_attempts=genuine_attempts,
            total_impostor_attempts=impostor_attempts
        )
    
    async def _evaluate_from_pairs(
        self,
        user_embeddings: Dict[str, np.ndarray],
        threshold: float
    ) -> EvaluationResult:
        """Evaluate by generating test pairs from stored embeddings"""
        user_ids = list(user_embeddings.keys())
        
        true_positives = 0
        true_negatives = 0
        false_positives = 0
        false_negatives = 0
        
        genuine_attempts = 0
        impostor_attempts = 0
        
        # Generate genuine pairs (same user)
        for user_id in user_ids:
            embedding = user_embeddings[user_id]
            # Compare with itself (perfect match)
            similarity = self.calculate_similarity(embedding, embedding)
            genuine_attempts += 1
            
            if similarity >= threshold:
                true_positives += 1
            else:
                false_negatives += 1
        
        # Generate impostor pairs (different users)
        for i, user_id1 in enumerate(user_ids):
            for user_id2 in user_ids[i+1:]:
                emb1 = user_embeddings[user_id1]
                emb2 = user_embeddings[user_id2]
                
                similarity = self.calculate_similarity(emb1, emb2)
                impostor_attempts += 1
                
                if similarity >= threshold:
                    false_positives += 1
                else:
                    true_negatives += 1
        
        # Calculate metrics
        far = false_positives / impostor_attempts if impostor_attempts > 0 else 0.0
        frr = false_negatives / genuine_attempts if genuine_attempts > 0 else 0.0
        
        total = true_positives + true_negatives + false_positives + false_negatives
        accuracy = (true_positives + true_negatives) / total if total > 0 else 0.0
        
        return EvaluationResult(
            threshold=threshold,
            far=far,
            frr=frr,
            accuracy=accuracy,
            true_positives=true_positives,
            true_negatives=true_negatives,
            false_positives=false_positives,
            false_negatives=false_negatives,
            total_genuine_attempts=genuine_attempts,
            total_impostor_attempts=impostor_attempts
        )
    
    async def find_optimal_threshold(
        self,
        threshold_range: Tuple[float, float] = (0.5, 0.95),
        step: float = 0.05
    ) -> Dict:
        """Find optimal threshold that minimizes FAR + FRR"""
        best_threshold = threshold_range[0]
        best_eer = 1.0  # Equal Error Rate
        
        results = []
        
        threshold = threshold_range[0]
        while threshold <= threshold_range[1]:
            result = await self.evaluate_far_frr(threshold=threshold, use_logs=True)
            
            # Calculate EER (Equal Error Rate) - point where FAR = FRR
            eer = abs(result.far - result.frr)
            
            results.append({
                "threshold": threshold,
                "far": result.far,
                "frr": result.frr,
                "eer": eer,
                "accuracy": result.accuracy
            })
            
            if eer < best_eer:
                best_eer = eer
                best_threshold = threshold
            
            threshold += step
        
        return {
            "optimal_threshold": best_threshold,
            "best_eer": best_eer,
            "results": results
        }
