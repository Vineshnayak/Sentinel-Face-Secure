"""
YOLO-Nano Face Detector Module
Optional lightweight face detection using YOLO-Nano
Provides alternative to Haarcascade for better accuracy
"""

import cv2
import numpy as np
from typing import List, Tuple, Optional
import os

YOLO_CONFIDENCE_THRESHOLD = 0.5
YOLO_NMS_THRESHOLD = 0.4


class YOLOFaceDetector:
    """YOLO-Nano based face detector"""
    
    def __init__(self, model_path=None, use_gpu=False):
        self.net = None
        self.layer_names = None
        self.model_loaded = False
        self.use_gpu = use_gpu
        
        self._load_model(model_path)
    
    def _load_model(self, model_path=None):
        if model_path is None:
            model_path = self._find_default_model()
        
        if model_path and os.path.exists(model_path):
            try:
                self.net = cv2.dnn.readNetFromDarknet(model_path.replace('.weights', '.cfg'), model_path)
                
                if self.use_gpu:
                    self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_CUDA)
                    self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CUDA)
                else:
                    self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                    self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
                
                self.layer_names = self.net.getLayerNames()
                self.layer_names = [self.layer_names[i - 1] for i in self.net.getUnconnectedOutLayers()]
                self.model_loaded = True
            except Exception:
                self.model_loaded = False
        else:
            self.model_loaded = False
    
    def _find_default_model(self):
        possible_paths = [
            "yolo-face/yoloface.weights",
            "models/yoloface.weights",
            "yoloface.weights",
            "face-yolov4.weights"
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return path
        
        return None
    
    def detect_faces(self, image, confidence_threshold=YOLO_CONFIDENCE_THRESHOLD):
        """Detect faces in an image"""
        if not self.model_loaded or self.net is None:
            return []
        
        try:
            (H, W) = image.shape[:2]
            
            blob = cv2.dnn.blobFromImage(
                image, 1/255.0, (416, 416), 
                swapRB=True, crop=False
            )
            
            self.net.setInput(blob)
            outputs = self.net.forward(self.layer_names)
            
            boxes = []
            confidences = []
            
            for output in outputs:
                for detection in output:
                    scores = detection[5:]
                    class_id = np.argmax(scores)
                    confidence = scores[class_id]
                    
                    if confidence > confidence_threshold:
                        box = detection[0:4] * np.array([W, H, W, H])
                        (center_x, center_y, width, height) = box.astype("int")
                        
                        x = int(center_x - (width / 2))
                        y = int(center_y - (height / 2))
                        
                        boxes.append([x, y, int(width), int(height)])
                        confidences.append(float(confidence))
            
            indices = cv2.dnn.NMSBoxes(
                boxes, confidences, 
                confidence_threshold, 
                YOLO_NMS_THRESHOLD
            )
            
            results = []
            for i in indices.flatten():
                x, y, w, h = boxes[i]
                results.append((x, y, w, h, confidences[i]))
            
            return results
            
        except Exception:
            return []
    
    def get_largest_face(self, image, confidence_threshold=YOLO_CONFIDENCE_THRESHOLD):
        """Get the largest face in the image"""
        faces = self.detect_faces(image, confidence_threshold)
        
        if not faces:
            return None
        
        largest = max(faces, key=lambda f: f[2] * f[3])
        return (largest[0], largest[1], largest[2], largest[3])
    
    def is_loaded(self):
        return self.model_loaded


class YOLODetectorFactory:
    @staticmethod
    def create(use_gpu=False, model_path=None):
        return YOLOFaceDetector(model_path=model_path, use_gpu=use_gpu)


def get_yolo_detector(use_gpu=False, model_path=None):
    return YOLODetectorFactory.create(use_gpu=use_gpu, model_path=model_path)
