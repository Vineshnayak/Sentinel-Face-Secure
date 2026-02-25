"""
Masked Face and Eyeglasses Detection Handler
Handles face detection and recognition when faces are partially occluded
"""

import cv2
import numpy as np
from typing import Tuple, Optional, Dict


class MaskedFaceHandler:
    """Handle face detection and recognition with masks and eyeglasses"""
    
    def __init__(self):
        # Load eye cascade for eyeglasses detection
        try:
            self.eye_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_eye.xml'
            )
        except:
            self.eye_cascade = None
        
        # Load nose cascade for mask detection
        try:
            self.nose_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_mcs_nose.xml'
            )
        except:
            self.nose_cascade = None
    
    def detect_mask(self, face_region: np.ndarray) -> bool:
        """
        Detect if face is wearing a mask
        
        Args:
            face_region: Face region image (BGR)
            
        Returns:
            bool: True if mask detected
        """
        if self.nose_cascade is None:
            return False
        
        try:
            gray = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY)
            h, w = gray.shape
            
            # Check lower half of face (nose/mouth area)
            lower_half = gray[int(h * 0.4):, :]
            
            noses = self.nose_cascade.detectMultiScale(
                lower_half,
                scaleFactor=1.1,
                minNeighbors=3,
                minSize=(10, 10)
            )
            
            # If no nose detected in lower face, likely masked
            return len(noses) == 0
        except:
            return False
    
    def detect_eyeglasses(self, face_region: np.ndarray) -> bool:
        """
        Detect if face is wearing eyeglasses
        
        Args:
            face_region: Face region image (BGR)
            
        Returns:
            bool: True if eyeglasses detected
        """
        if self.eye_cascade is None:
            return False
        
        try:
            gray = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY)
            h, w = gray.shape
            
            # Check upper half of face (eye area)
            upper_half = gray[:int(h * 0.6), :]
            
            eyes = self.eye_cascade.detectMultiScale(
                upper_half,
                scaleFactor=1.1,
                minNeighbors=2,
                minSize=(15, 15)
            )
            
            # Eyeglasses often cause reflections or occlusions
            # Check for rectangular regions that might be glasses frames
            if len(eyes) >= 2:
                # Check for horizontal edges (glasses frames)
                edges = cv2.Canny(upper_half, 50, 150)
                horizontal_lines = cv2.HoughLinesP(
                    edges, 1, np.pi/180, threshold=30,
                    minLineLength=w//4, maxLineGap=10
                )
                
                if horizontal_lines is not None and len(horizontal_lines) > 2:
                    return True
            
            return False
        except:
            return False
    
    def enhance_masked_face(self, face_region: np.ndarray) -> np.ndarray:
        """
        Enhance face region when mask is detected
        Focus on upper face features (eyes, forehead)
        
        Args:
            face_region: Face region image
            
        Returns:
            Enhanced face region
        """
        enhanced = face_region.copy()
        
        # Increase contrast in upper face region
        h, w = face_region.shape[:2]
        upper_face = enhanced[:int(h * 0.6), :]
        
        # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
        if len(upper_face.shape) == 3:
            lab = cv2.cvtColor(upper_face, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            l = clahe.apply(l)
            lab = cv2.merge([l, a, b])
            upper_face = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        
        enhanced[:int(h * 0.6), :] = upper_face
        
        return enhanced
    
    def enhance_eyeglasses_face(self, face_region: np.ndarray) -> np.ndarray:
        """
        Enhance face region when eyeglasses are detected
        Reduce reflections and improve eye visibility
        
        Args:
            face_region: Face region image
            
        Returns:
            Enhanced face region
        """
        enhanced = face_region.copy()
        
        # Apply bilateral filter to reduce reflections while preserving edges
        enhanced = cv2.bilateralFilter(enhanced, 9, 75, 75)
        
        # Increase contrast slightly
        lab = cv2.cvtColor(enhanced, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
        l = clahe.apply(l)
        lab = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        
        return enhanced
    
    def get_face_metadata(self, face_region: np.ndarray) -> Dict[str, bool]:
        """
        Get metadata about face occlusions
        
        Args:
            face_region: Face region image
            
        Returns:
            Dict with mask and eyeglasses detection results
        """
        return {
            "has_mask": self.detect_mask(face_region),
            "has_eyeglasses": self.detect_eyeglasses(face_region)
        }
    
    def preprocess_occluded_face(self, face_region: np.ndarray) -> Tuple[np.ndarray, Dict[str, bool]]:
        """
        Preprocess face region handling occlusions
        
        Args:
            face_region: Face region image
            
        Returns:
            Tuple of (preprocessed_image, metadata)
        """
        metadata = self.get_face_metadata(face_region)
        
        enhanced = face_region.copy()
        
        if metadata["has_mask"]:
            enhanced = self.enhance_masked_face(enhanced)
        
        if metadata["has_eyeglasses"]:
            enhanced = self.enhance_eyeglasses_face(enhanced)
        
        return enhanced, metadata


def create_masked_face_handler() -> MaskedFaceHandler:
    """Factory function to create masked face handler"""
    return MaskedFaceHandler()
