"""
CNN-based Face Embedding Module
Lightweight MobileNetV2 for edge deployment
"""

import torch
import torch.nn as nn
import torchvision.transforms as transforms
from torchvision import models
import numpy as np
from PIL import Image
import cv2
import os
import warnings
warnings.filterwarnings('ignore')

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"CNN Embedding: Device = {device}")


class FaceEmbeddingModel(nn.Module):
    """MobileNetV2-based face embedding model"""
    def __init__(self, embedding_dim=128, pretrained=True):
        super(FaceEmbeddingModel, self).__init__()
        
        # Load MobileNetV2 backbone
        try:
            if pretrained:
                self.backbone = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
            else:
                self.backbone = models.mobilenet_v2(weights=None)
        except Exception as e:
            print(f"Warning: Could not load pretrained weights: {e}")
            self.backbone = models.mobilenet_v2(weights=None)
        
        num_features = self.backbone.classifier[1].in_features
        
        # Replace classifier with embedding layer
        self.backbone.classifier = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(num_features, embedding_dim),
            nn.BatchNorm1d(embedding_dim)
        )
        
        self.embedding_dim = embedding_dim
        
    def forward(self, x):
        x = self.backbone(x)
        return x


class CNNEmbeddingExtractor:
    """CNN-based embedding extractor for face recognition"""
    
    def __init__(self, embedding_dim=128, pretrained=True):
        self.embedding_dim = embedding_dim
        self.model = None
        self.pretrained = pretrained
        self._load_model()
        
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
        
    def _load_model(self):
        """Load MobileNetV2 model with error handling"""
        try:
            print(f"Loading MobileNetV2 (embedding_dim={self.embedding_dim})...")
            self.model = FaceEmbeddingModel(
                embedding_dim=self.embedding_dim,
                pretrained=self.pretrained
            ).to(device)
            self.model.eval()
            print("CNN Embedding: MobileNetV2 loaded successfully")
        except Exception as e:
            print(f"CNN Embedding: Failed to load - {e}")
            self.model = None
    
    def is_loaded(self):
        """Check if model is loaded"""
        return self.model is not None
    
    def preprocess_face(self, face_image):
        """Preprocess face image for CNN input"""
        if face_image is None:
            return None
            
        if isinstance(face_image, np.ndarray):
            # Convert BGR to RGB
            if len(face_image.shape) == 3:
                face_image = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
            face_image = Image.fromarray(face_image)
        
        if face_image.mode != 'RGB':
            face_image = face_image.convert('RGB')
        
        tensor = self.transform(face_image)
        return tensor.unsqueeze(0).to(device)
    
    def extract_embedding(self, face_image):
        """Extract 128D embedding from face image"""
        if self.model is None:
            raise RuntimeError("CNN embedding model not loaded")
        
        if face_image is None:
            return None
        
        try:
            with torch.no_grad():
                tensor = self.preprocess_face(face_image)
                
                if tensor is None:
                    return None
                
                embedding = self.model(tensor)
                
                # L2 normalize
                embedding = nn.functional.normalize(embedding, p=2, dim=1)
                
                # Convert to numpy
                embedding = embedding.cpu().numpy().flatten()
                
                return embedding
                
        except Exception as e:
            print(f"Embedding extraction error: {e}")
            return None
    
    def extract_multiple_embeddings(self, face_images):
        """Extract and average embeddings from multiple face images"""
        embeddings = []
        
        for face_image in face_images:
            embedding = self.extract_embedding(face_image)
            if embedding is not None:
                embeddings.append(embedding)
        
        if not embeddings:
            return None
        
        # Average all embeddings
        avg_embedding = np.mean(embeddings, axis=0)
        
        # L2 normalize
        norm = np.linalg.norm(avg_embedding)
        if norm > 0:
            avg_embedding = avg_embedding / norm
        
        return avg_embedding
    
    def compute_similarity(self, embedding1, embedding2, method="cosine"):
        """Compute similarity between two embeddings"""
        if embedding1 is None or embedding2 is None:
            return 0.0
        
        try:
            if method == "cosine":
                dot_product = np.dot(embedding1, embedding2)
                norm1 = np.linalg.norm(embedding1)
                norm2 = np.linalg.norm(embedding2)
                
                if norm1 > 0 and norm2 > 0:
                    similarity = dot_product / (norm1 * norm2)
                    # Clip to [0, 1] range
                    return max(0.0, min(1.0, similarity))
                return 0.0
            else:
                # Euclidean distance based similarity
                distance = np.linalg.norm(embedding1 - embedding2)
                similarity = 1.0 / (1.0 + distance)
                return similarity
        except Exception:
            return 0.0


def load_embedding_model(embedding_dim=128):
    """Factory function to load the embedding model"""
    return CNNEmbeddingExtractor(embedding_dim=embedding_dim)


# Quick test function
if __name__ == "__main__":
    extractor = CNNEmbeddingExtractor(embedding_dim=128)
    
    if extractor.is_loaded():
        # Create test image (random noise)
        test_image = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
        
        embedding = extractor.extract_embedding(test_image)
        
        if embedding is not None:
            print(f"Embedding shape: {embedding.shape}")
            print(f"Embedding norm: {np.linalg.norm(embedding):.4f}")
            print("CNN Embedding test PASSED")
        else:
            print("CNN Embedding test FAILED - could not extract embedding")
    else:
        print("CNN Embedding test FAILED - model not loaded")
