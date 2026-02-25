"""
LFW Evaluation Module for Sentinel Face Secure
Evaluates facial authentication system using LFW dataset with CNN-based embeddings
"""

import os
import numpy as np
import cv2
import torch
import torchvision.transforms as transforms
from torchvision import models
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from collections import defaultdict
from fastapi import FastAPI, HTTPException
from PIL import Image


# Configuration
LFW_DATASET_PATH = os.path.join(os.path.dirname(__file__), "lfw-deepfunneled", "lfw-deepfunneled")
HAAR_CASCADE_PATH = os.path.join(os.path.dirname(__file__), "haarcascade_frontalface_default.xml")
MATCHING_THRESHOLD = 0.7
EMBEDDING_DIM = 128

# Device configuration
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


@dataclass
class EvaluationMetrics:
    """Container for evaluation metrics"""
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    far: float
    frr: float
    true_positives: int
    true_negatives: int
    false_positives: int
    false_negatives: int
    total_positive_pairs: int
    total_negative_pairs: int
    skipped_images: int
    processed_images: int


class CNNEmbeddingExtractor:
    """Extract face embeddings using MobileNetV2 CNN"""
    
    def __init__(self, embedding_dim: int = EMBEDDING_DIM):
        self.embedding_dim = embedding_dim
        self.model = self._load_model()
        
        # Image preprocessing transforms
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
        
        # Face detection
        self.face_cascade = None
        if os.path.exists(HAAR_CASCADE_PATH):
            self.face_cascade = cv2.CascadeClassifier(HAAR_CASCADE_PATH)
        else:
            self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
    def _load_model(self):
        """Load pretrained MobileNetV2 model"""
        try:
            model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
            
            # Remove classification layer and add embedding layer
            num_features = model.classifier[1].in_features
            model.classifier = torch.nn.Sequential(
                torch.nn.Dropout(0.3),
                torch.nn.Linear(num_features, self.embedding_dim),
                torch.nn.BatchNorm1d(self.embedding_dim)
            )
            
            model = model.to(device)
            model.eval()
            return model
        except Exception as e:
            print(f"Failed to load CNN model: {e}")
            return None
    
    def detect_face(self, image: np.ndarray) -> Optional[np.ndarray]:
        """Detect and extract face region from image"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.05,
            minNeighbors=3,
            minSize=(40, 40),
            maxSize=(400, 400)
        )
        
        if len(faces) == 0:
            return None
        
        # Use largest face
        faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
        x, y, w, h = faces[0]
        
        face_region = image[y:y+h, x:x+w]
        return face_region
    
    def preprocess_face(self, face_region: np.ndarray) -> torch.Tensor:
        """Preprocess face for CNN input"""
        # Convert BGR to RGB
        if len(face_region.shape) == 3:
            face_region = cv2.cvtColor(face_region, cv2.COLOR_BGR2RGB)
        
        face_image = Image.fromarray(face_region)
        
        if face_image.mode != 'RGB':
            face_image = face_image.convert('RGB')
        
        tensor = self.transform(face_image)
        return tensor.unsqueeze(0).to(device)
    
    def extract_embedding(self, image: np.ndarray) -> Optional[np.ndarray]:
        """Extract 128D embedding from face image"""
        if self.model is None:
            raise RuntimeError("CNN model not loaded")
        
        face_region = self.detect_face(image)
        if face_region is None:
            return None
        
        with torch.no_grad():
            try:
                tensor = self.preprocess_face(face_region)
                embedding = self.model(tensor)
                
                # L2 normalize
                embedding = torch.nn.functional.normalize(embedding, p=2, dim=1)
                
                return embedding.cpu().numpy().flatten()
            except Exception:
                return None
    
    def extract_embedding_from_path(self, image_path: str) -> Optional[np.ndarray]:
        """Extract embedding from image file"""
        image = cv2.imread(image_path)
        if image is None:
            return None
        return self.extract_embedding(image)


class LFWDataLoader:
    """Load and organize LFW dataset"""
    
    def __init__(self, dataset_path: str):
        self.dataset_path = dataset_path
        self.persons: Dict[str, List[str]] = defaultdict(list)
        self._load_dataset()
    
    def _load_dataset(self):
        """Load all images from LFW dataset"""
        if not os.path.exists(self.dataset_path):
            raise FileNotFoundError(f"LFW dataset not found at: {self.dataset_path}")
        
        for person_name in os.listdir(self.dataset_path):
            person_path = os.path.join(self.dataset_path, person_name)
            if os.path.isdir(person_path):
                for image_name in os.listdir(person_path):
                    if image_name.endswith(('.jpg', '.jpeg', '.png')):
                        image_path = os.path.join(person_path, image_name)
                        self.persons[person_name].append(image_path)
        
        print(f"Loaded {len(self.persons)} persons from LFW dataset")
    
    def get_persons_with_multiple_images(self, min_images: int = 2) -> Dict[str, List[str]]:
        """Get persons with at least min_images for positive pairs"""
        return {
            name: images 
            for name, images in self.persons.items() 
            if len(images) >= min_images
        }
    
    def get_all_persons(self) -> List[str]:
        """Get list of all person names"""
        return list(self.persons.keys())


class LFWEvaluator:
    """Evaluate facial authentication system on LFW dataset"""
    
    def __init__(self, threshold: float = MATCHING_THRESHOLD):
        self.threshold = threshold
        self.extractor = CNNEmbeddingExtractor(embedding_dim=EMBEDDING_DIM)
        self.data_loader = None
    
    def cosine_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Calculate cosine similarity between two embeddings"""
        dot_product = np.dot(emb1, emb2)
        norm1 = np.linalg.norm(emb1)
        norm2 = np.linalg.norm(emb2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    def load_dataset(self, dataset_path: str):
        """Load LFW dataset"""
        self.data_loader = LFWDataLoader(dataset_path)
    
    def generate_pairs(self) -> Tuple[List[Tuple[str, str, bool]], int, int]:
        """Generate positive and negative pairs from LFW dataset"""
        if self.data_loader is None:
            raise ValueError("Dataset not loaded")
        
        pairs = []
        skipped = 0
        processed = 0
        
        persons = self.data_loader.get_persons_with_multiple_images()
        all_persons = self.data_loader.get_all_persons()
        
        # Generate positive pairs (same person)
        for person_name, images in persons.items():
            for i in range(len(images)):
                for j in range(i + 1, len(images)):
                    pairs.append((images[i], images[j], True))
                    processed += 1
        
        # Generate negative pairs (different persons)
        np.random.seed(42)
        positive_count = len(pairs)
        num_negative_pairs = min(positive_count, len(persons) * 2)
        
        sampled_persons = np.random.choice(all_persons, size=min(500, len(all_persons)), replace=False)
        
        negative_count = 0
        for i in range(len(sampled_persons)):
            for j in range(i + 1, len(sampled_persons)):
                if negative_count >= num_negative_pairs:
                    break
                
                img1 = np.random.choice(self.data_loader.persons[sampled_persons[i]])
                img2 = np.random.choice(self.data_loader.persons[sampled_persons[j]])
                pairs.append((img1, img2, False))
                negative_count += 1
            
            if negative_count >= num_negative_pairs:
                break
        
        print(f"Generated {len(pairs)} pairs for evaluation")
        return pairs, skipped, processed
    
    def evaluate(self) -> EvaluationMetrics:
        """Run evaluation on LFW dataset"""
        if self.extractor.model is None:
            raise RuntimeError("CNN model not loaded")
        
        pairs, skipped, processed = self.generate_pairs()
        
        true_positives = 0
        true_negatives = 0
        false_positives = 0
        false_negatives = 0
        
        positive_pairs = 0
        negative_pairs = 0
        
        batch_size = 100
        
        for i in range(0, len(pairs), batch_size):
            batch = pairs[i:i + batch_size]
            
            for img1_path, img2_path, is_same_person in batch:
                emb1 = self.extractor.extract_embedding_from_path(img1_path)
                emb2 = self.extractor.extract_embedding_from_path(img2_path)
                
                if emb1 is None or emb2 is None:
                    skipped += 1
                    continue
                
                similarity = self.cosine_similarity(emb1, emb2)
                predicted_match = similarity >= self.threshold
                
                if is_same_person:
                    positive_pairs += 1
                    if predicted_match:
                        true_positives += 1
                    else:
                        false_negatives += 1
                else:
                    negative_pairs += 1
                    if predicted_match:
                        false_positives += 1
                    else:
                        true_negatives += 1
        
        total = true_positives + true_negatives + false_positives + false_negatives
        
        accuracy = (true_positives + true_negatives) / total if total > 0 else 0.0
        precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0.0
        recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0.0
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        
        far = false_positives / negative_pairs if negative_pairs > 0 else 0.0
        frr = false_negatives / positive_pairs if positive_pairs > 0 else 0.0
        
        return EvaluationMetrics(
            accuracy=accuracy,
            precision=precision,
            recall=recall,
            f1_score=f1_score,
            far=far,
            frr=frr,
            true_positives=true_positives,
            true_negatives=true_negatives,
            false_positives=false_positives,
            false_negatives=false_negatives,
            total_positive_pairs=positive_pairs,
            total_negative_pairs=negative_pairs,
            skipped_images=skipped,
            processed_images=processed
        )
    
    def get_metrics_dict(self, metrics: EvaluationMetrics) -> Dict:
        """Convert metrics to dictionary for JSON response"""
        return {
            "accuracy": round(metrics.accuracy, 4),
            "precision": round(metrics.precision, 4),
            "recall": round(metrics.recall, 4),
            "f1_score": round(metrics.f1_score, 4),
            "far": round(metrics.far, 4),
            "frr": round(metrics.frr, 4),
            "true_positives": metrics.true_positives,
            "true_negatives": metrics.true_negatives,
            "false_positives": metrics.false_positives,
            "false_negatives": metrics.false_negatives,
            "total_positive_pairs": metrics.total_positive_pairs,
            "total_negative_pairs": metrics.total_negative_pairs,
            "skipped_images": metrics.skipped_images,
            "processed_images": metrics.processed_images,
            "matching_threshold": self.threshold,
            "embedding_dim": EMBEDDING_DIM,
            "model": "MobileNetV2"
        }


def create_evaluation_endpoint(app: FastAPI):
    """Create and register the LFW evaluation endpoint"""
    
    @app.get("/api/evaluate-lfw")
    async def evaluate_lfw():
        """Run LFW evaluation and return metrics"""
        try:
            evaluator = LFWEvaluator(threshold=MATCHING_THRESHOLD)
            
            evaluator.load_dataset(LFW_DATASET_PATH)
            
            metrics = evaluator.evaluate()
            
            return {
                "status": "success",
                "message": "LFW evaluation completed successfully",
                "model": "MobileNetV2",
                "embedding_dim": EMBEDDING_DIM,
                "metrics": evaluator.get_metrics_dict(metrics)
            }
        
        except FileNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except RuntimeError as e:
            raise HTTPException(status_code=500, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")
    
    @app.get("/api/evaluate-lfw/status")
    async def evaluate_status():
        """Check if LFW dataset is available"""
        exists = os.path.exists(LFW_DATASET_PATH)
        return {
            "dataset_available": exists,
            "dataset_path": LFW_DATASET_PATH,
            "threshold": MATCHING_THRESHOLD,
            "model": "MobileNetV2",
            "embedding_dim": EMBEDDING_DIM
        }


def run_evaluation():
    """Run evaluation as standalone script"""
    print("Starting LFW Evaluation with CNN...")
    print(f"Dataset path: {LFW_DATASET_PATH}")
    print(f"Matching threshold: {MATCHING_THRESHOLD}")
    print(f"Embedding dimension: {EMBEDDING_DIM}")
    print(f"Device: {device}")
    
    evaluator = LFWEvaluator(threshold=MATCHING_THRESHOLD)
    
    evaluator.load_dataset(LFW_DATASET_PATH)
    
    metrics = evaluator.evaluate()
    
    print("\n" + "="*50)
    print("LFW Evaluation Results (MobileNetV2 CNN)")
    print("="*50)
    print(f"Accuracy:     {metrics.accuracy:.4f}")
    print(f"Precision:    {metrics.precision:.4f}")
    print(f"Recall:       {metrics.recall:.4f}")
    print(f"F1 Score:     {metrics.f1_score:.4f}")
    print(f"FAR:          {metrics.far:.4f}")
    print(f"FRR:          {metrics.frr:.4f}")
    print(f"True Pos:     {metrics.true_positives}")
    print(f"True Neg:     {metrics.true_negatives}")
    print(f"False Pos:    {metrics.false_positives}")
    print(f"False Neg:    {metrics.false_negatives}")
    print(f"Skipped:      {metrics.skipped_images}")
    print("="*50)
    
    return metrics


if __name__ == "__main__":
    run_evaluation()
