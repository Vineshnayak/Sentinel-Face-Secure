"""
Enhanced Liveness Detection Module with Video Spoofing Detection
Combines multiple anti-spoofing techniques:
- Blink detection
- Frame motion detection
- Head movement detection
- Video spoofing detection (2D vs 3D analysis, texture patterns, screen artifacts)
Returns combined liveness score
"""

import cv2
import numpy as np
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass
from scipy import ndimage


@dataclass
class LivenessResult:
    """Liveness detection result"""
    is_real: bool
    liveness_score: float
    blink_score: float
    motion_score: float
    head_movement_score: float
    video_spoof_score: float
    details: Dict[str, float]


class BlinkDetector:
    """Eye blink detection for liveness"""
    
    def __init__(self, ear_threshold=0.15, min_blinks=1):
        self.ear_threshold = ear_threshold
        self.min_blinks = min_blinks
        
    def calculate_ear(self, eye_landmarks):
        p1, p2, p3, p4, p5, p6 = eye_landmarks
        
        ear1 = np.linalg.norm(p2 - p6)
        ear2 = np.linalg.norm(p3 - p5)
        ear = (ear1 + ear2) / (2 * np.linalg.norm(p1 - p4) + 1e-6)
        
        return ear
    
    def detect_blinks(self, frames: List[np.ndarray]) -> Tuple[int, float]:
        """Detect blinks in a sequence of frames"""
        if len(frames) < 3:
            return 0, 0.0
        
        blink_count = 0
        ear_values = []
        is_blinking = False
        
        for frame in frames:
            try:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                eyes = self._detect_eyes_simple(gray)
                
                if len(eyes) >= 2:
                    eyes = sorted(eyes, key=lambda e: e[0])
                    
                    ear_left = self._calculate_eye_ratio(eyes[0], gray)
                    ear_right = self._calculate_eye_ratio(eyes[1], gray)
                    avg_ear = (ear_left + ear_right) / 2
                    ear_values.append(avg_ear)
                    
                    if avg_ear < self.ear_threshold and not is_blinking:
                        blink_count += 1
                        is_blinking = True
                    elif avg_ear >= self.ear_threshold:
                        is_blinking = False
                else:
                    ear_values.append(1.0)
                    
            except Exception:
                ear_values.append(1.0)
        
        blink_score = min(1.0, blink_count / self.min_blinks) if self.min_blinks > 0 else 0.0
        
        return blink_count, blink_score
    
    def _detect_eyes_simple(self, gray):
        """Simple eye detection based on image regions"""
        eyes = []
        h, w = gray.shape
        
        eye_region = gray[:h//2, :]
        
        _, thresh = cv2.threshold(eye_region, 50, 255, cv2.THRESH_BINARY)
        
        contours, _ = cv2.findContours(
            thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        
        for contour in contours:
            x, y, cw, ch = cv2.boundingRect(contour)
            if 20 < cw < 100 and 10 < ch < 50:
                eyes.append((x, y, cw, ch))
        
        return eyes[:2]
    
    def _calculate_eye_ratio(self, eye_region, gray):
        """Calculate eye openness ratio"""
        x, y, w, h = eye_region
        roi = gray[y:y+h, x:x+w]
        
        if roi.size == 0 or w < 10 or h < 5:
            return 1.0
        
        _, thresh = cv2.threshold(roi, 70, 255, cv2.THRESH_BINARY)
        white_ratio = np.sum(thresh == 255) / (roi.size + 1e-6)
        
        return white_ratio


class MotionDetector:
    """Frame motion detection for liveness"""
    
    def __init__(self, motion_threshold=0.002):
        self.motion_threshold = motion_threshold
        self.prev_frame = None
        
    def detect_motion(self, frames: List[np.ndarray]) -> float:
        """Detect motion in a sequence of frames"""
        if len(frames) < 2:
            return 0.0
        
        motion_scores = []
        
        for i in range(1, len(frames)):
            try:
                gray1 = cv2.cvtColor(frames[i-1], cv2.COLOR_BGR2GRAY)
                gray2 = cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY)
                
                gray1 = cv2.resize(gray1, (64, 64))
                gray2 = cv2.resize(gray2, (64, 64))
                
                diff = cv2.absdiff(gray1, gray2)
                
                motion = np.sum(diff > 30) / diff.size
                motion_scores.append(motion)
                
            except Exception:
                motion_scores.append(0.0)
        
        avg_motion = np.mean(motion_scores) if motion_scores else 0.0
        
        motion_score = min(1.0, avg_motion / self.motion_threshold)
        
        return motion_score


class HeadMovementDetector:
    """Head movement detection for liveness"""
    
    def __init__(self, face_size_tolerance=0.15):
        self.face_size_tolerance = face_size_tolerance
        self.prev_face_size = None
        
    def detect_head_movement(self, face_sizes: List[Tuple[int, int]]) -> float:
        """Detect head movements based on face size changes"""
        if len(face_sizes) < 2:
            return 0.0
        
        movement_scores = []
        
        for i in range(1, len(face_sizes)):
            curr_w, curr_h = face_sizes[i]
            prev_w, prev_h = face_sizes[i-1]
            
            if prev_w == 0 or prev_h == 0:
                continue
            
            w_ratio = abs(curr_w - prev_w) / prev_w
            h_ratio = abs(curr_h - prev_h) / prev_h
            
            if w_ratio < self.face_size_tolerance and h_ratio < self.face_size_tolerance:
                movement_scores.append(min(1.0, (w_ratio + h_ratio) / self.face_size_tolerance))
            else:
                movement_scores.append(0.0)
        
        if movement_scores:
            avg_movement = np.mean(movement_scores)
            score = 1.0 - abs(avg_movement - 0.3) * 2
            return max(0.0, min(1.0, score))
        
        return 0.0


class VideoSpoofingDetector:
    """
    Video Spoofing Detection for anti-replay attacks
    Detects recorded videos played in front of camera vs live faces
    """
    
    def __init__(self):
        # Face quality thresholds
        self.quality_threshold = 50.0
        self.texture_variance_threshold = 500.0
        
        # Storage for temporal analysis
        self.face_qualities = []
        self.texture_features = []
        self.motion_patterns = []
        
    def analyze_face_quality(self, face_region: np.ndarray) -> float:
        """
        Analyze face region quality using Laplacian variance
        Live faces have natural texture, videos may have compression artifacts
        """
        if face_region is None or face_region.size == 0:
            return 0.0
        
        try:
            gray = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY)
            
            # Compute Laplacian (2nd derivative) for sharpness/quality
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            
            # Live faces typically have higher quality variance
            # Videos often have lower or inconsistent quality
            quality_score = min(1.0, laplacian_var / self.quality_threshold)
            
            return float(quality_score)
            
        except Exception:
            return 0.0
    
    def extract_lbp_features(self, face_region: np.ndarray) -> np.ndarray:
        """
        Extract Local Binary Pattern features for texture analysis
        Live faces and video displays have different LBP patterns
        """
        if face_region is None or face_region.size == 0:
            return np.zeros(256)
        
        try:
            gray = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY)
            
            # Use LBP for texture analysis
            lbp = self._compute_lbp(gray)
            
            # Compute histogram
            hist, _ = np.histogram(lbp.ravel(), bins=256, range=(0, 255))
            hist = hist.astype(np.float32)
            hist = hist / (hist.sum() + 1e-6)  # Normalize
            
            return hist
            
        except Exception:
            return np.zeros(256)
    
    def _compute_lbp(self, gray: np.ndarray, radius: int = 1, points: int = 8) -> np.ndarray:
        """Compute basic LBP features"""
        h, w = gray.shape
        lbp = np.zeros((h, w), dtype=np.uint8)
        
        for i in range(radius, h - radius):
            for j in range(radius, w - radius):
                center = gray[i, j]
                binary = 0
                
                for k in range(points):
                    angle = 2 * np.pi * k / points
                    x = int(i + radius * np.cos(angle))
                    y = int(j + radius * np.sin(angle))
                    
                    if 0 <= x < h and 0 <= y < w:
                        if gray[x, y] >= center:
                            binary |= (1 << k)
                
                lbp[i, j] = binary
        
        return lbp
    
    def detect_screen_artifacts(self, face_region: np.ndarray) -> float:
        """
        Detect screen/display artifacts in face region
        Videos played on screens have specific artifacts:
        - Moire patterns
        - Color banding
        - Screen refresh patterns
        """
        if face_region is None or face_region.size == 0:
            return 0.0
        
        try:
            # Convert to HSV for color analysis
            hsv = cv2.cvtColor(face_region, cv2.COLOR_BGR2HSV)
            
            # Check for color banding in saturation channel
            sat = hsv[:, :, 1]
            
            # Compute gradient magnitude
            grad_x = cv2.Sobel(sat, cv2.CV_64F, 1, 0, ksize=3)
            grad_y = cv2.Sobel(sat, cv2.CV_64F, 0, 1, ksize=3)
            gradient_magnitude = np.sqrt(grad_x**2 + grad_y**2)
            
            # High frequency patterns indicate possible screen content
            high_freq_content = np.mean(gradient_magnitude > 50)
            
            # Also check for periodic patterns (screen refresh)
            if face_region.shape[1] > 50:
                row_means = np.mean(face_region, axis=1)
                # Look for periodic patterns in rows
                if len(row_means) > 10:
                    try:
                        fft = np.fft.fft(row_means - np.mean(row_means))
                        freq_magnitude = np.abs(fft)
                        dominant_freq = np.argmax(freq_magnitude[1:len(freq_magnitude)//2])
                        # Strong periodic components suggest screen content
                        periodic_score = freq_magnitude[dominant_freq + 1] / (np.mean(freq_magnitude) + 1e-6)
                        periodic_score = min(1.0, periodic_score / 10)
                    except:
                        periodic_score = 0.0
                else:
                    periodic_score = 0.0
            else:
                periodic_score = 0.0
            
            # Combine indicators
            artifact_score = (high_freq_content + periodic_score) / 2
            
            return float(artifact_score)
            
        except Exception:
            return 0.0
    
    def analyze_motion_consistency(self, frames: List[np.ndarray]) -> float:
        """
        Analyze motion patterns for video replay detection
        Videos have consistent frame-to-frame motion (playback speed)
        Live faces have more natural, variable motion
        """
        if len(frames) < 3:
            return 0.0
        
        try:
            motion_differences = []
            
            for i in range(2, len(frames)):
                gray1 = cv2.cvtColor(frames[i-2], cv2.COLOR_BGR2GRAY)
                gray2 = cv2.cvtColor(frames[i-1], cv2.COLOR_BGR2GRAY)
                gray3 = cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY)
                
                # Resize for efficiency
                gray1 = cv2.resize(gray1, (32, 32))
                gray2 = cv2.resize(gray2, (32, 32))
                gray3 = cv2.resize(gray3, (32, 32))
                
                # Motion between consecutive frames
                motion1 = np.mean(np.abs(gray2 - gray1))
                motion2 = np.mean(np.abs(gray3 - gray2))
                
                # Consistency ratio
                if motion1 > 0:
                    consistency = abs(motion1 - motion2) / motion1
                else:
                    consistency = 1.0
                
                motion_differences.append(consistency)
            
            # Videos tend to have more consistent motion (lower variation)
            avg_consistency = np.mean(motion_differences) if motion_differences else 0.0
            
            # High consistency suggests video replay
            video_like_score = min(1.0, avg_consistency)
            
            return float(video_like_score)
            
        except Exception:
            return 0.0
    
    def detect_face_edge_artifacts(self, face_region: np.ndarray) -> float:
        """
        Detect edge artifacts common in video frames
        Videos often have artificial edge enhancement or artifacts
        """
        if face_region is None or face_region.size == 0:
            return 0.0
        
        try:
            gray = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY)
            
            # Detect edges
            edges = cv2.Canny(gray, 50, 150)
            
            # Check edge density and uniformity
            edge_density = np.sum(edges > 0) / edges.size
            
            # Compute edge direction histogram
            grad_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
            grad_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
            
            angles = np.arctan2(grad_y, grad_x)
            angle_hist, _ = np.histogram(angles.ravel(), bins=36, range=(-np.pi, np.pi))
            angle_hist = angle_hist.astype(np.float32)
            angle_hist = angle_hist / (angle_hist.sum() + 1e-6)
            
            # Natural faces have more diverse edge directions
            angle_diversity = 1.0 - np.max(angle_hist)
            
            # Videos often have more uniform edge patterns
            artifact_score = 1.0 - (edge_density * 0.5 + angle_diversity * 0.5)
            
            return float(max(0.0, min(1.0, artifact_score)))
            
        except Exception:
            return 0.0
    
    def check_video_spoofing(self, 
                             face_region: np.ndarray, 
                             frames: List[np.ndarray] = None) -> Tuple[bool, float]:
        """
        Comprehensive video spoofing check
        
        Returns:
            is_real: True if likely live face, False if likely video replay
            spoof_score: 0.0 = live, 1.0 = video replay
        """
        if face_region is None or face_region.size == 0:
            return False, 1.0
        
        # Individual checks
        quality_score = 1.0 - self.analyze_face_quality(face_region)
        artifact_score = self.detect_screen_artifacts(face_region)
        edge_score = self.detect_face_edge_artifacts(face_region)
        
        # Temporal analysis if frames available
        temporal_score = 0.0
        if frames and len(frames) >= 3:
            temporal_score = self.analyze_motion_consistency(frames)
        
        # Weighted combination
        w_quality = 0.25
        w_artifact = 0.25
        w_edge = 0.20
        w_temporal = 0.30
        
        spoof_score = (
            w_quality * quality_score +
            w_artifact * artifact_score +
            w_edge * edge_score +
            w_temporal * temporal_score
        )
        
        # Threshold for spoof detection
        is_spoof = spoof_score > 0.45  # Adjusted threshold for better detection
        
        return not is_spoof, spoof_score


class EnhancedLivenessDetector:
    """Combined liveness detection using multiple techniques including video spoofing"""
    
    def __init__(self, 
                 ear_threshold=0.15,
                 min_blinks=1,
                 motion_threshold=0.002,
                 face_size_tolerance=0.15):
        self.blink_detector = BlinkDetector(ear_threshold, min_blinks)
        self.motion_detector = MotionDetector(motion_threshold)
        self.head_detector = HeadMovementDetector(face_size_tolerance)
        self.video_spoof_detector = VideoSpoofingDetector()
        
    def check_liveness(self, 
                       image: np.ndarray, 
                       frames: List[np.ndarray] = None,
                       face_sizes: List[Tuple[int, int]] = None) -> LivenessResult:
        """Comprehensive liveness check including video spoofing detection"""
        blink_count = 0
        blink_score = 0.0
        if frames and len(frames) >= 3:
            blink_count, blink_score = self.blink_detector.detect_blinks(frames)
        
        motion_score = 0.0
        if frames and len(frames) >= 2:
            motion_score = self.motion_detector.detect_motion(frames)
        
        head_movement_score = 0.0
        if face_sizes and len(face_sizes) >= 2:
            head_movement_score = self.head_detector.detect_head_movement(face_sizes)
        
        # Video spoofing detection
        video_spoof_score = 0.0
        is_live_face = True
        
        # Detect face region from image
        face_region = None
        try:
            if image is not None:
                # Simple face detection (use center portion as fallback)
                h, w = image.shape[:2]
                face_size = min(h, w) // 2
                start_x = (w - face_size) // 2
                start_y = (h - face_size) // 2
                face_region = image[start_y:start_y+face_size, start_x:start_x+face_size]
        except Exception:
            pass
        
        if face_region is not None:
            is_live_face, video_spoof_score = self.video_spoof_detector.check_video_spoofing(
                face_region, frames
            )
        
        # Weights for different techniques
        w_blink = 0.25
        w_motion = 0.25
        w_head = 0.20
        w_video = 0.30
        
        combined_score = (
            w_blink * blink_score +
            w_motion * motion_score +
            w_head * head_movement_score +
            w_video * (1.0 - video_spoof_score)  # Higher is better for live face
        )
        
        # Must pass video spoofing check AND have reasonable liveness
        is_real = is_live_face and combined_score >= 0.15
        
        return LivenessResult(
            is_real=is_real,
            liveness_score=combined_score,
            blink_score=blink_score,
            motion_score=motion_score,
            head_movement_score=head_movement_score,
            video_spoof_score=video_spoof_score,
            details={
                "blink_count": blink_count,
                "min_blinks_required": self.blink_detector.min_blinks,
                "motion_intensity": motion_score,
                "head_movement_intensity": head_movement_score,
                "video_spoofing_detected": video_spoof_score > 0.45,
                "is_live_face": is_live_face
            }
        )
    
    def simple_check(self, image: np.ndarray) -> Tuple[bool, float]:
        """Simple liveness check (single image)"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        
        mean_val = np.mean(gray)
        std_val = np.std(gray)
        
        brightness_ok = 50 < mean_val < 200
        contrast_ok = std_val > 30
        
        if brightness_ok and contrast_ok:
            return True, 0.5
        
        return False, 0.2


def create_liveness_detector(
    ear_threshold=0.15,
    min_blinks=1,
    motion_threshold=0.002,
    face_size_tolerance=0.15
) -> EnhancedLivenessDetector:
    """Factory function to create enhanced liveness detector"""
    return EnhancedLivenessDetector(
        ear_threshold=ear_threshold,
        min_blinks=min_blinks,
        motion_threshold=motion_threshold,
        face_size_tolerance=face_size_tolerance
    )
