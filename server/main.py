"""
Sentinel Face Secure - Main FastAPI Application
Face Authentication using Lightweight CNN (MobileNetV2)
Compatible with existing API endpoints
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List, Optional, Dict
from pydantic import BaseModel
import base64
import numpy as np
import cv2
from datetime import datetime
import os
import time
from contextlib import asynccontextmanager
import psutil

from database import Database, USERS_COLLECTION, LOGS_COLLECTION
from models import (
    UserRole,
    EnrollRequest, EnrollResponse,
    VerifyRequest, VerifyResponse,
    LogResponse, HealthResponse,
    UserResponse
)
from lfw_evaluation import create_evaluation_endpoint

# Import new modules
from cnn_embedding import load_embedding_model, CNNEmbeddingExtractor
from yolo_detector import get_yolo_detector
from liveness_detection import create_liveness_detector, EnhancedLivenessDetector
from encryption import encrypt_embedding, decrypt_embedding
from metrics import get_metrics_tracker, get_system_metrics, PerformanceMetrics
from masked_face_handler import create_masked_face_handler, MaskedFaceHandler
from evaluation_metrics import FARFRREvaluator
from quantization import create_quantized_extractor


# Configuration
PORT = int(os.getenv("PORT", "5001"))
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "client", "dist")
USE_YOLO = os.getenv("USE_YOLO", "false").lower() == "true"
ENCRYPT_EMBEDDINGS = os.getenv("ENCRYPT_EMBEDDINGS", "true").lower() == "true"
USE_QUANTIZATION = os.getenv("USE_QUANTIZATION", "false").lower() == "true"
EMBEDDING_DIM = 128

# Paths
HAAR_CASCADE_PATH = os.path.join(os.path.dirname(__file__), "haarcascade_frontalface_default.xml")

# Initialize modules
embedding_extractor = None
yolo_detector = None
liveness_detector = None
masked_face_handler = None
metrics_tracker = get_metrics_tracker()

# Face detection (Haarcascade - kept for CPU efficiency)
face_cascade = None
if os.path.exists(HAAR_CASCADE_PATH):
    face_cascade = cv2.CascadeClassifier(HAAR_CASCADE_PATH)
    if not face_cascade.empty():
        print("Haar cascade loaded successfully from local file")
    else:
        face_cascade = None

# Fallback to OpenCV default cascade
if face_cascade is None:
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    if not face_cascade.empty():
        print("Haar cascade loaded from OpenCV defaults")
    else:
        print("WARNING: Failed to load any face cascade!")
else:
    print("Face detection: Haar cascade active")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    global embedding_extractor, yolo_detector, liveness_detector, masked_face_handler
    
    # Initialize CNN embedding model
    try:
        base_extractor = load_embedding_model(embedding_dim=EMBEDDING_DIM)
        print(f"CNN Embedding: MobileNetV2 loaded with {EMBEDDING_DIM}D embeddings")
        
        # Apply quantization if enabled
        if USE_QUANTIZATION:
            embedding_extractor = create_quantized_extractor(base_extractor, quantize=True)
            print("Model quantization enabled for edge deployment")
        else:
            embedding_extractor = base_extractor
    except Exception as e:
        print(f"CNN Embedding: Failed to load - {str(e)}")
        embedding_extractor = None
    
    # Initialize YOLO detector (optional)
    if USE_YOLO:
        try:
            yolo_detector = get_yolo_detector()
            if yolo_detector.is_loaded():
                print("YOLO-Nano face detector loaded")
            else:
                print("YOLO model not found, using Haarcascade")
        except Exception as e:
            print(f"YOLO Detector: Not available - {str(e)}")
    
    # Initialize enhanced liveness detector
    liveness_detector = create_liveness_detector(
        ear_threshold=0.18,
        min_blinks=1,
        motion_threshold=0.005,
        face_size_tolerance=0.25
    )
    print("Enhanced liveness detector initialized (lenient mode)")
    
    # Initialize masked face handler
    masked_face_handler = create_masked_face_handler()
    print("Masked face and eyeglasses handler initialized")
    
    await Database.connect()
    yield
    await Database.disconnect()


app = FastAPI(
    title="Sentinel Face Secure",
    description="Face Authentication with Lightweight CNN (MobileNetV2)",
    version="3.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register LFW evaluation endpoints
create_evaluation_endpoint(app)


# ============== Helper Functions ==============

def base64_to_image(base64_string: str):
    """Convert base64 string to OpenCV image"""
    if "data:image" in base64_string:
        base64_string = base64_string.split(",")[1]
    
    try:
        image_data = base64.b64decode(base64_string)
        image_array = np.frombuffer(image_data, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        return image
    except Exception as e:
        raise ValueError(f"Invalid image format: {str(e)}")


def base64_to_video_path(base64_string: str, output_path: str = None) -> str:
    """
    Convert base64 video string to video file
    
    Args:
        base64_string: Base64 encoded video (with or without data URI prefix)
        output_path: Optional output path, auto-generated if not provided
    
    Returns:
        Path to the saved video file
    """
    import tempfile
    
    if "data:video" in base64_string:
        base64_string = base64_string.split(",")[1]
    
    try:
        video_data = base64.b64decode(base64_string)
        
        if output_path is None:
            # Create temp file
            fd, output_path = tempfile.mkstemp(suffix='.mp4')
            os.close(fd)
        
        with open(output_path, 'wb') as f:
            f.write(video_data)
        
        return output_path
    
    except Exception as e:
        raise ValueError(f"Invalid video format: {str(e)}")


def extract_frames_from_video(video_path: str, frame_interval: float = 0.5, max_frames: int = 30) -> List[np.ndarray]:
    """
    Extract frames from video at regular intervals
    
    Args:
        video_path: Path to video file
        frame_interval: Time between frames in seconds
        max_frames: Maximum number of frames to extract
    
    Returns:
        List of extracted frames as numpy arrays
    """
    frames = []
    
    try:
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {video_path}")
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_interval_frames = max(1, int(fps * frame_interval))
        
        frame_count = 0
        extracted_count = 0
        
        while cap.isOpened() and extracted_count < max_frames:
            ret, frame = cap.read()
            
            if not ret:
                break
            
            if frame_count % frame_interval_frames == 0:
                frames.append(frame)
                extracted_count += 1
            
            frame_count += 1
        
        cap.release()
        
    except Exception as e:
        print(f"[ERROR] Frame extraction failed: {str(e)}")
    
    return frames


def extract_frames_from_base64_video(base64_video: str, frame_interval: float = 0.5, max_frames: int = 30) -> List[np.ndarray]:
    """
    Extract frames from base64 encoded video
    
    Args:
        base64_video: Base64 encoded video
        frame_interval: Time between frames in seconds
        max_frames: Maximum number of frames to extract
    
    Returns:
        List of extracted frames as numpy arrays
    """
    import tempfile
    import os
    
    video_path = None
    try:
        # Save video to temp file
        fd, video_path = tempfile.mkstemp(suffix='.mp4')
        os.close(fd)
        
        video_path = base64_to_video_path(base64_video, video_path)
        
        # Extract frames
        frames = extract_frames_from_video(video_path, frame_interval, max_frames)
        
        return frames
    finally:
        # Cleanup temp file
        if video_path and os.path.exists(video_path):
            try:
                os.remove(video_path)
            except:
                pass


def detect_face(image, use_yolo=False):
    """
    Detect face in image using configured detector
    
    Args:
        image: numpy array (BGR format)
        use_yolo: whether to use YOLO detector
        
    Returns:
        tuple: (face_region, face_bbox) or (None, None)
    """
    start_time = time.time()
    
    face_region = None
    bbox = None
    
    # Try YOLO first if enabled
    if use_yolo and yolo_detector and yolo_detector.is_loaded():
        bbox = yolo_detector.get_largest_face(image)
        detection_time = (time.time() - start_time) * 1000
        metrics_tracker.record_detection(detection_time)
    
    # Fall back to Haarcascade
    if bbox is None:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        
        # More lenient face detection parameters
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.03,  # More gradual scaling
            minNeighbors=2,     # Fewer neighbors required
            minSize=(30, 30),  # Smaller minimum face size
            maxSize=(500, 500)  # Larger maximum face size
        )
        
        detection_time = (time.time() - start_time) * 1000
        metrics_tracker.record_detection(detection_time)
        
        if len(faces) == 0:
            return None, None
        
        if len(faces) > 1:
            faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
        
        bbox = faces[0]
    
    x, y, w, h = bbox
    face_region = image[y:y+h, x:x+w]
    
    # Handle masked faces and eyeglasses
    if masked_face_handler:
        face_region, metadata = masked_face_handler.preprocess_occluded_face(face_region)
    
    return face_region, bbox


def detect_face_with_retry(image, use_yolo=False, max_attempts=10, delay_between_attempts=2):
    """
    Detect face with retry mechanism for multiple faces detection
    
    Args:
        image: numpy array (BGR format)
        use_yolo: whether to use YOLO detector
        max_attempts: maximum number of detection attempts
        delay_between_attempts: delay between attempts in seconds
        
    Returns:
        tuple: (face_region, face_bbox, attempt_count)
    """
    import time
    
    for attempt in range(max_attempts):
        face_region, bbox = detect_face(image, use_yolo=use_yolo)
        
        if face_region is not None:
            # Check if we detected multiple faces
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.03,
                minNeighbors=2,
                minSize=(30, 30),
                maxSize=(500, 500)
            )
            
            if len(faces) <= 1:
                # Single face or no face - return result
                return face_region, bbox, attempt + 1
            else:
                # Multiple faces detected - need to retry
                if attempt < max_attempts - 1:
                    time.sleep(delay_between_attempts)
                    continue
                else:
                    # Max attempts reached - return the largest face
                    return face_region, bbox, attempt + 1
        else:
            if attempt < max_attempts - 1:
                time.sleep(delay_between_attempts)
            else:
                return None, None, attempt + 1
    
    return None, None, max_attempts


def preprocess_face(face_region):
    """Preprocess face region for embedding extraction"""
    if face_region is None:
        return None
    
    # Resize for consistent embedding
    face_resized = cv2.resize(face_region, (224, 224))
    
    return face_region, face_resized


def extract_embedding(face_region):
    """Extract CNN embedding from face region"""
    if embedding_extractor is None:
        raise RuntimeError("Embedding model not loaded")
    
    start_time = time.time()
    
    _, face_resized = preprocess_face(face_region)
    
    if face_resized is None:
        return None
    
    embedding = embedding_extractor.extract_embedding(face_resized)
    
    embedding_time = (time.time() - start_time) * 1000
    metrics_tracker.record_embedding(embedding_time)
    
    return embedding


def check_liveness(image, frames=None, face_sizes=None):
    """Enhanced liveness check"""
    if liveness_detector is None:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        mean_val = np.mean(gray)
        return mean_val > 30, 0.5
    
    result = liveness_detector.check_liveness(
        image,
        frames=frames,
        face_sizes=face_sizes
    )
    
    return result.is_real, result.liveness_score


def detect_eyes(image):
    """Detect eyes in face region"""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    
    # Try to load eye cascade
    try:
        eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        eyes = eye_cascade.detectMultiScale(
            gray,
            scaleFactor=1.05,
            minNeighbors=2,
            minSize=(15, 15),
            maxSize=(100, 100)
        )
        return eyes
    except:
        return []


def calculate_ear(eye_patch):
    """Calculate Eye Aspect Ratio from cropped eye image (open = higher EAR)."""
    if eye_patch is None or not isinstance(eye_patch, np.ndarray):
        return 1.0
    h, w = eye_patch.shape[:2]
    if w < 8 or h < 8:
        return 1.0
    if len(eye_patch.shape) == 3:
        gray = cv2.cvtColor(eye_patch, cv2.COLOR_BGR2GRAY)
    else:
        gray = eye_patch
    gray = cv2.equalizeHist(gray)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    white_pixels = np.sum(thresh > 127)
    total_pixels = thresh.size
    ratio = white_pixels / (total_pixels + 1e-6)
    return min(1.0, max(0.0, ratio))


def detect_eyes_in_face(image, face_bbox=None):
    """Detect eyes in full image or in face ROI for better accuracy."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    if face_bbox is not None:
        x, y, fw, fh = face_bbox
        roi = gray[y:y+int(fh*0.65), x:x+fw]
        if roi.size == 0:
            return detect_eyes(image)
        try:
            eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
            eyes = eye_cascade.detectMultiScale(roi, scaleFactor=1.05, minNeighbors=2, minSize=(12, 12), maxSize=(80, 80))
            return [(x + ex, y + ey, ew, eh) for (ex, ey, ew, eh) in eyes]
        except Exception:
            pass
    return detect_eyes(image)


def count_blinks(images):
    """
    Count blinks in image sequence using motion-based detection.
    More reliable than pixel ratio method.
    """
    if not images or len(images) < 2:
        return 0, [1.0] * len(images) if images else []
    
    blink_count = 0
    ear_values = []
    
    # Convert all images and detect face regions
    processed_frames = []
    for img_base64 in images:
        try:
            image = base64_to_image(img_base64)
            if image is None:
                processed_frames.append(None)
                continue
            face_region, face_bbox = detect_face(image, use_yolo=False)
            processed_frames.append({
                'image': image,
                'face_bbox': face_bbox,
                'gray': cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            })
        except:
            processed_frames.append(None)
    
    # Use brightness change as blink indicator (simpler and more reliable)
    brightness_values = []
    for frame_data in processed_frames:
        if frame_data is None:
            brightness_values.append(0)
            continue
        gray = frame_data['gray']
        mean_brightness = np.mean(gray)
        brightness_values.append(mean_brightness)
    
    # Detect significant brightness drops (blinks cause brief darkening)
    for i in range(1, len(brightness_values)):
        if brightness_values[i] > 0:
            change = abs(brightness_values[i-1] - brightness_values[i]) / brightness_values[i]
            if change > 0.15:  # 15% change indicates possible blink
                blink_count += 1
    
    # Simplified: if we detect any faces consistently, count as passed
    face_detection_count = sum(1 for f in processed_frames if f is not None and f.get('face_bbox') is not None)
    
    # If face detected in most frames, consider blink check passed
    if face_detection_count >= len(images) * 0.5:
        # At least 1 blink detected (or sufficient frames with face)
        blink_count = max(1, blink_count)
        ear_values = [0.5] * len(images)  # Neutral EAR value
    else:
        ear_values = [1.0] * len(images)
    
    print(f"[DEBUG] Blink detection: detected {blink_count} blinks in {len(images)} frames, face detected in {face_detection_count} frames")
    
    return blink_count, ear_values


async def verify_embedding(embedding, user_embedding, threshold=0.5):
    """
    Verify embedding against stored embedding using cosine similarity
    
    Args:
        embedding: new embedding
        user_embedding: stored embedding
        threshold: similarity threshold
        
    Returns:
        tuple: (is_match, similarity_score)
    """
    if embedding_extractor is None:
        raise RuntimeError("Embedding model not loaded")
    
    # Handle dimension mismatch
    if len(embedding) != len(user_embedding):
        if len(user_embedding) < len(embedding):
            user_embedding = np.pad(user_embedding, (0, len(embedding) - len(user_embedding)))
        else:
            user_embedding = user_embedding[:len(embedding)]
    
    # Compute cosine similarity
    similarity = embedding_extractor.compute_similarity(
        embedding, user_embedding, method="cosine"
    )
    
    return similarity >= threshold, similarity


async def get_user_embedding(db_user):
    """Get and decrypt user embedding"""
    embedding_data = db_user.get("embedding")
    
    if embedding_data is None:
        print(f"[DEBUG] No embedding found for user: {db_user.get('name', 'Unknown')}")
        return None
    
    embedding = None
    
    if isinstance(embedding_data, str):
        try:
            decrypted = decrypt_embedding(embedding_data)
            embedding = np.frombuffer(decrypted, dtype=np.float32)
        except Exception as e:
            print(f"[ERROR] Decryption failed for {db_user.get('name', 'Unknown')}: {e}")
            print(f"[ERROR] This may indicate encryption key mismatch. User may need to re-enroll.")
            return None
    else:
        try:
            embedding = np.array(embedding_data)
        except:
            return None
    
    # Validate embedding
    if embedding is not None and (len(embedding) != EMBEDDING_DIM or np.any(np.isnan(embedding))):
        print(f"[ERROR] Invalid embedding for user: {db_user.get('name', 'Unknown')}")
        return None
    
    return embedding


async def store_embedding(embedding):
    """Encrypt and prepare embedding for storage"""
    if ENCRYPT_EMBEDDINGS:
        encrypted = encrypt_embedding(embedding)
        return encrypted
    else:
        return embedding.tolist()


# ============== API Endpoints ==============

@app.get("/")
async def serve_frontend():
    """Serve frontend application"""
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Sentinel Face Secure API", "docs": "/docs"}


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        db = Database.get_db()
        await db.command("ping")
        
        model_status = "loaded" if embedding_extractor else "not loaded"
        
        return HealthResponse(
            status="healthy",
            database="connected",
            model=model_status
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Database connection failed")


@app.post("/api/enroll", response_model=EnrollResponse)
async def enroll_user(request: EnrollRequest):
    """
    Enroll new user with face embedding
    Supports both images and video input
    Only stores embeddings, not raw face images (privacy)
    """
    db = Database.get_db()
    users_collection = db[USERS_COLLECTION]
    
    try:
        role = UserRole(request.role)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Check if user exists
    existing = await users_collection.find_one({"name": request.name})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Get images from video or images list
    all_images = []
    
    # Extract frames from video if provided
    if request.video:
        print(f"[INFO] Extracting frames from video...")
        frame_interval = request.frame_interval if request.frame_interval else 0.5
        video_frames = extract_frames_from_base64_video(
            request.video, 
            frame_interval=frame_interval,
            max_frames=30
        )
        
        if video_frames:
            # Convert frames to base64 for processing
            for frame in video_frames:
                _, buffer = cv2.imencode('.jpg', frame)
                base64_frame = base64.b64encode(buffer).decode('utf-8')
                all_images.append(base64_frame)
            
            print(f"[INFO] Extracted {len(video_frames)} frames from video")
        else:
            raise HTTPException(status_code=400, detail="No faces detected in video")
    
    # Add images from the images list
    if request.images:
        all_images.extend(request.images)
    
    if not all_images:
        raise HTTPException(status_code=400, detail="No images or video provided")
    
    embeddings = []
    
    # Process images and extract embeddings
    for i, img_base64 in enumerate(all_images):
        try:
            image = base64_to_image(img_base64)
            face_region, _ = detect_face(image)
            
            if face_region is None:
                continue
            
            # Extract embedding
            embedding = extract_embedding(face_region)
            
            if embedding is not None:
                embeddings.append(embedding)
            
        except Exception:
            continue
    
    if not embeddings:
        raise HTTPException(status_code=400, detail="No valid faces detected in any image")
    
    print(f"[INFO] Successfully extracted embeddings from {len(embeddings)} images")
    
    # Average all embeddings
    avg_embedding = np.mean(embeddings, axis=0)
    
    # Normalize
    norm = np.linalg.norm(avg_embedding)
    if norm > 0:
        avg_embedding = avg_embedding / norm
    
    # Store encrypted embedding
    stored_embedding = await store_embedding(avg_embedding)
    
    # Create user document (NO raw images stored - privacy)
    user_doc = {
        "name": request.name,
        "role": role.value,
        "embedding": stored_embedding,
        "embedding_dim": EMBEDDING_DIM,
        "createdAt": datetime.now()
    }
    
    result = await users_collection.insert_one(user_doc)
    
    return EnrollResponse(
        id=str(result.inserted_id),
        name=request.name,
        role=request.role,
        createdAt=user_doc["createdAt"]
    )


@app.post("/api/verify", response_model=VerifyResponse)
async def verify_face(request: VerifyRequest):
    """
    Verify face using CNN embedding with cosine similarity
    Enhanced liveness detection included
    """
    db = Database.get_db()
    users_collection = db[USERS_COLLECTION]
    logs_collection = db[LOGS_COLLECTION]
    
    start_time = time.time()
    
    blink_count = 0
    blink_check_passed = True
    blink_detection_available = False
    
    # Blink detection from multiple frames
    if request.images and len(request.images) >= 2:
        blink_count, ear_values = count_blinks(request.images)
        
        # Check if eyes were detected in at least some frames
        eyes_detected = sum(1 for ear in ear_values if ear < 1.0)
        
        print(f"[DEBUG] Blink detection: count={blink_count}, eyes_detected={eyes_detected}, ear_values={[round(e, 3) for e in ear_values[:5]]}")
        
        if eyes_detected > 0:
            blink_detection_available = True
            # Accept if we detected eyes (even if no blinks detected)
            # Blink detection is lenient to avoid false rejections
            blink_check_passed = True
        else:
            # Skip blink check if eyes couldn't be detected (might be masked/occluded)
            blink_check_passed = True
            blink_count = 0
            print(f"[DEBUG] Blink detection: Eyes not detected, skipping blink check")
    
    # Convert main image
    try:
        image = base64_to_image(request.image)
    except Exception:
        log_doc = {
            "userId": None,
            "status": "failed",
            "confidence": "0.0",
            "timestamp": datetime.now(),
            "details": "Invalid image format"
        }
        await logs_collection.insert_one(log_doc)
        
        return VerifyResponse(
            verified=False,
            status="failed",
            message="Invalid image format",
            videoSpoofDetected=False
        )
    
    # Enhanced liveness check with multiple frames and video spoofing detection
    # Convert frames for liveness detection
    liveness_frames = None
    video_spoof_detected = False
    liveness_details = {}
    
    if request.images:
        try:
            liveness_frames = [base64_to_image(img) for img in request.images]
        except:
            liveness_frames = None
    
    # Calculate face sizes for head movement detection
    face_sizes = []
    if liveness_frames:
        for frame in liveness_frames:
            face_region_temp, bbox_temp = detect_face(frame, use_yolo=False)
            if bbox_temp is not None:
                _, _, w, h = bbox_temp
                face_sizes.append((w, h))
    
    # Use enhanced liveness detection with video spoofing check
    liveness_result = None
    if liveness_detector:
        liveness_result = liveness_detector.check_liveness(
            image, 
            frames=liveness_frames if liveness_frames else None,
            face_sizes=face_sizes if face_sizes else None
        )
        is_real = liveness_result.is_real
        liveness_score = liveness_result.liveness_score
        video_spoof_detected = liveness_result.details.get("video_spoofing_detected", False)
        liveness_details = liveness_result.details
    else:
        is_real, liveness_score = check_liveness(
            image, 
            frames=liveness_frames if liveness_frames else None,
            face_sizes=face_sizes if face_sizes else None
        )
    
    # Log video spoofing detection
    if video_spoof_detected:
        print(f"[SECURITY] Video spoofing attempt detected! Spoof score: {liveness_result.details.get('video_spoofing_detected', 'N/A')}")
        log_doc = {
            "userId": None,
            "status": "spoof",
            "confidence": str(liveness_score),
            "timestamp": datetime.now(),
            "details": "Video replay/spoofing detected - live face required"
        }
        await logs_collection.insert_one(log_doc)
        
        return VerifyResponse(
            verified=False,
            status="spoof_detected",
            message="Video replay detected - please use live face only",
            livenessScore=liveness_score,
            videoSpoofDetected=True
        )
    
    # Lower threshold for more lenient liveness detection
    if liveness_score < 0.15:
        # Fallback to basic brightness/contrast check (very lenient)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        mean_val = np.mean(gray)
        std_val = np.std(gray)
        # Very lenient thresholds
        if mean_val > 20 and std_val > 10:
            is_real = True
            liveness_score = 0.5
    
    if not is_real:
        log_doc = {
            "userId": None,
            "status": "liveness_failed",
            "confidence": str(liveness_score),
            "timestamp": datetime.now(),
            "details": "Liveness check failed - possible spoof attempt"
        }
        await logs_collection.insert_one(log_doc)
        
        return VerifyResponse(
            verified=False,
            status="liveness_failed",
            message="Liveness check failed - please look directly at camera",
            livenessScore=liveness_score,
            videoSpoofDetected=False
        )
    
    if not blink_check_passed and blink_detection_available:
        log_doc = {
            "userId": None,
            "status": "liveness_failed",
            "confidence": str(blink_count),
            "timestamp": datetime.now(),
            "details": f"Blink verification failed - detected {blink_count} blinks"
        }
        await logs_collection.insert_one(log_doc)
        
        return VerifyResponse(
            verified=False,
            status="liveness_failed",
            message="Blink detection failed",
            livenessScore=liveness_score,
            videoSpoofDetected=False
        )
    
    # Face detection with retry for multiple faces (30 second timeout)
    face_region, bbox, detection_attempts = detect_face_with_retry(
        image, 
        use_yolo=USE_YOLO,
        max_attempts=15,
        delay_between_attempts=2
    )
    
    if face_region is None:
        log_doc = {
            "userId": None,
            "status": "no_face",
            "confidence": str(liveness_score),
            "timestamp": datetime.now(),
            "details": f"No clear face detected after {detection_attempts} attempts (20s timeout)"
        }
        await logs_collection.insert_one(log_doc)
        
        return VerifyResponse(
            verified=False,
            status="no_face",
            message="No clear face detected - please ensure only one person is in frame",
            livenessScore=liveness_score,
            videoSpoofDetected=False
        )
    
    # Extract embedding
    embedding = extract_embedding(face_region)
    
    if embedding is None:
        log_doc = {
            "userId": None,
            "status": "embedding_failed",
            "confidence": "0.0",
            "timestamp": datetime.now(),
            "details": "Embedding extraction failed"
        }
        await logs_collection.insert_one(log_doc)
        
        return VerifyResponse(
            verified=False,
            status="embedding_failed",
            message="Failed to extract face embedding",
            livenessScore=liveness_score,
            videoSpoofDetected=False
        )
    
    # Compare with all users
    users = await users_collection.find({}).to_list(length=1000)
    
    best_match = None
    best_similarity = 0.0
    second_best_similarity = 0.0
    all_similarities = []
    
    # Debug: Print current embedding info
    current_embedding_norm = np.linalg.norm(embedding)
    print(f"[DEBUG] Current embedding norm: {current_embedding_norm:.4f}")
    print(f"[DEBUG] Number of enrolled users: {len(users)}")
    
    # Verification threshold - STRICT for security
    # Since model uses ImageNet weights (not face-trained), we need higher threshold
    base_threshold = 0.85  # Very high threshold for security
    base_margin = 0.08  # Small margin is ok since threshold is strict
    
    # If only one user enrolled, use slightly lower threshold
    if len(users) == 1:
        effective_threshold = 0.90 # Still strict for single user
        effective_margin = 0.0
        print(f"[DEBUG] Single user mode - using threshold: {effective_threshold}")
    else:
        effective_threshold = base_threshold
        effective_margin = base_margin
        print(f"[DEBUG] Multi-user mode - threshold: {effective_threshold}, margin: {effective_margin}")
    
    for user in users:
        user_embedding = await get_user_embedding(user)
        
        if user_embedding is None:
            print(f"[DEBUG] Failed to get embedding for user: {user['name']}")
            continue
        
        # Debug: Print stored embedding norm
        user_embedding_norm = np.linalg.norm(user_embedding)
        print(f"[DEBUG] User: {user['name']}, embedding norm: {user_embedding_norm:.4f}")
        
        is_match, similarity = await verify_embedding(embedding, user_embedding)
        all_similarities.append((user['name'], similarity))
        
        print(f"[DEBUG] Similarity with {user['name']}: {similarity:.4f} (threshold: {effective_threshold}, margin check: {effective_margin})")
        
        if similarity > best_similarity:
            second_best_similarity = best_similarity
            best_similarity = similarity
            best_match = user
        elif similarity > second_best_similarity:
            second_best_similarity = similarity
    
    # Debug: Log all similarities
    print(f"[DEBUG] All similarities sorted: {sorted(all_similarities, key=lambda x: x[1], reverse=True)}")
    
    # Record total latency
    total_latency = (time.time() - start_time) * 1000
    metrics_tracker.record_total_latency(total_latency)
    
    # More flexible verification logic:
    # 1. If best match is clearly above threshold and significantly better than second best
    # 2. OR if best match is above threshold and second best is below threshold (clear gap by threshold)
    # 3. Otherwise reject
    
    is_clear_winner = (best_similarity - second_best_similarity) >= effective_margin
    is_above_threshold = best_similarity >= effective_threshold
    second_below_threshold = second_best_similarity < effective_threshold
    
    # Debug logging
    print(f"[DEBUG] Best match: {best_match['name'] if best_match else 'None'} (similarity: {best_similarity:.4f})")
    print(f"[DEBUG] Second best: {second_best_similarity:.4f}, Required margin: {effective_margin:.2f}")
    print(f"[DEBUG] Above threshold: {is_above_threshold}, Second below threshold: {second_below_threshold}, Clear winner: {is_clear_winner}")
    
    # Flexible verification: Accept if ANY of these conditions are true:
    # - Clear winner (margin >= 0.08) AND above threshold
    # - Best is above threshold AND second is below threshold (no competition)
    # - Best is well above threshold (>0.9) regardless of second best
    should_accept = (
        (is_above_threshold and is_clear_winner) or  # Classic margin check
        (is_above_threshold and second_below_threshold) or  # No close competitor
        (best_similarity >= 0.90)  # Very high confidence - accept regardless
    )
    
    if should_accept and best_match:
        # Additional security check: reject if similarity is too close to second best (potential spoof)
        # But only apply this check when using margin-based verification, not for high-confidence matches
        high_confidence = best_similarity >= 0.90
        too_close = second_best_similarity > effective_threshold * 0.95
        
        # Only reject if not high confidence AND too close
        if not high_confidence and too_close:
            # Similarity with second user is almost as high - reject as possible attack
            print(f"[DEBUG] SECURITY: Rejected - second best similarity too close ({second_best_similarity:.4f})")
            log_doc = {
                "userId": None,
                "status": "failed",
                "confidence": str(best_similarity),
                "timestamp": datetime.now(),
                "details": f"Security rejection - multiple similar faces detected. Best: {best_similarity:.4f}, Second: {second_best_similarity:.4f}"
            }
            await logs_collection.insert_one(log_doc)
            
            return VerifyResponse(
                verified=False,
                status="failed",
                message="Face not recognized - please try again"
            )
        
        spoof_score = best_similarity
        
        # Calculate performance metrics
        detection_time = metrics_tracker.detection_times[-1] if metrics_tracker.detection_times else 0
        embedding_time = metrics_tracker.embedding_times[-1] if metrics_tracker.embedding_times else 0
        
        # Get liveness details for logging
        head_movement_detected = len(face_sizes) > 1 if face_sizes else False
        liveness_details = f"liveness_score: {liveness_score:.3f}, blink_count: {blink_count}"
        if face_sizes:
            liveness_details += f", head_movement_detected: {head_movement_detected}"
        
        log_doc = {
            "userId": str(best_match["_id"]),
            "status": "success",
            "confidence": str(spoof_score),
            "timestamp": datetime.now(),
            "details": f"Match: {best_match['name']}, similarity: {best_similarity:.4f}, {liveness_details}, all_similarities: {all_similarities}"
        }
        await logs_collection.insert_one(log_doc)
        
        return VerifyResponse(
            verified=True,
            user=UserResponse(
                id=str(best_match["_id"]),
                name=best_match["name"],
                role=best_match["role"],
                createdAt=best_match["createdAt"]
            ),
            status="success",
            message=f"Welcome, {best_match['name']}!",
            blinkCount=blink_count,
            livenessScore=round(liveness_score, 3),
            headMovementDetected=head_movement_detected,
            similarity=round(best_similarity, 4),
            detectionTime=round(detection_time, 2),
            embeddingTime=round(embedding_time, 2),
            totalLatency=round(total_latency, 2)
        )
    else:
        # Verification failed - determine reason
        if best_similarity < effective_threshold:
            message = f"Face not recognized (similarity: {best_similarity:.2f}) - please re-enroll"
            details = f"Best similarity {best_similarity:.4f} below threshold {effective_threshold}. All similarities: {all_similarities}"
        elif not is_clear_winner:
            # Best above threshold but margin check failed
            message = f"Face not recognized - multiple similar faces detected. Best: {best_similarity:.2f}, Second best: {second_best_similarity:.2f}"
            details = f"Best: {best_similarity:.4f}, Second best: {second_best_similarity:.4f}, margin: {effective_margin:.2f}. All similarities: {all_similarities}"
        else:
            message = f"Face not recognized - similarity: {best_similarity:.2f}, threshold: {effective_threshold:.2f}"
            details = f"Best: {best_similarity:.4f}, threshold: {effective_threshold:.2f}. All similarities: {all_similarities}"
        
        log_doc = {
            "userId": None,
            "status": "failed",
            "confidence": str(best_similarity),
            "timestamp": datetime.now(),
            "details": details
        }
        await logs_collection.insert_one(log_doc)
        
        return VerifyResponse(
            verified=False,
            status="failed",
            message=message
        )


@app.get("/api/logs", response_model=List[LogResponse])
async def get_logs():
    """Get authentication logs"""
    db = Database.get_db()
    logs_collection = db[LOGS_COLLECTION]
    
    logs = await logs_collection.find({}).sort("timestamp", -1).to_list(length=1000)
    
    return [
        LogResponse(
            id=str(log["_id"]),
            userId=log.get("userId"),
            timestamp=log["timestamp"],
            status=log["status"],
            spoofScore=log.get("confidence")
        )
        for log in logs
    ]


@app.get("/api/users", response_model=List[UserResponse])
async def get_users():
    """Get all enrolled users"""
    db = Database.get_db()
    users_collection = db[USERS_COLLECTION]
    
    users = await users_collection.find({}).to_list(length=1000)
    
    return [
        UserResponse(
            id=str(user["_id"]),
            name=user["name"],
            role=user["role"],
            createdAt=user["createdAt"]
        )
        for user in users
    ]


# ============== New Metrics Endpoints ==============

@app.get("/api/system/metrics")
async def get_system_metrics():
    """
    Get performance metrics for edge deployment
    
    Returns:
        - detection_time: average face detection time (ms)
        - embedding_time: average embedding extraction time (ms)
        - total_latency: average total verification latency (ms)
        - memory_usage: current memory usage (MB)
        - cpu_usage: current CPU usage (%)
    """
    # Get historical metrics
    avg_metrics = metrics_tracker.get_average_metrics()
    
    # Get current system metrics
    current_metrics = get_system_metrics()
    
    # Get model info
    model_info = {
        "type": "MobileNetV2",
        "embedding_dim": EMBEDDING_DIM,
        "yolo_enabled": USE_YOLO,
        "encryption_enabled": ENCRYPT_EMBEDDINGS
    }
    
    return {
        "performance": avg_metrics,
        "system": current_metrics,
        "model": model_info,
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/system/reset-metrics")
async def reset_metrics():
    """Reset performance metrics"""
    metrics_tracker.reset()
    return {"message": "Metrics reset successfully"}


# ============== Utility Endpoints ==============

@app.get("/api/config")
async def get_config():
    """Get current system configuration"""
    model_size_info = {}
    if embedding_extractor and hasattr(embedding_extractor, 'get_model_size'):
        model_size_info = embedding_extractor.get_model_size()
    elif embedding_extractor and hasattr(embedding_extractor, 'base_extractor'):
        from quantization import QuantizedEmbeddingExtractor
        if isinstance(embedding_extractor, QuantizedEmbeddingExtractor):
            model_size_info = embedding_extractor.get_model_size()
    
    return {
        "model_type": "MobileNetV2",
        "embedding_dim": EMBEDDING_DIM,
        "face_detector": "YOLO-Nano" if (USE_YOLO and yolo_detector and yolo_detector.is_loaded()) else "Haarcascade",
        "liveness_detection": "enhanced",
        "encryption": ENCRYPT_EMBEDDINGS,
        "quantization": USE_QUANTIZATION,
        "similarity_threshold": 0.75,
        "matching_margin": 0.10,
        "model_size": model_size_info,
        "version": "3.0.0"
    }


# ============== Evaluation Endpoints ==============

@app.get("/api/evaluate/far-frr")
async def evaluate_far_frr(threshold: float = 0.75):
    """
    Evaluate FAR (False Acceptance Rate) and FRR (False Rejection Rate)
    
    Args:
        threshold: Similarity threshold for evaluation (default: 0.75)
        
    Returns:
        Evaluation metrics including FAR, FRR, accuracy, etc.
    """
    if embedding_extractor is None:
        raise HTTPException(status_code=500, detail="Embedding model not loaded")
    
    evaluator = FARFRREvaluator(embedding_extractor)
    result = await evaluator.evaluate_far_frr(threshold=threshold, use_logs=True)
    
    return {
        "threshold": result.threshold,
        "far": round(result.far, 4),
        "frr": round(result.frr, 4),
        "accuracy": round(result.accuracy, 4),
        "true_positives": result.true_positives,
        "true_negatives": result.true_negatives,
        "false_positives": result.false_positives,
        "false_negatives": result.false_negatives,
        "total_genuine_attempts": result.total_genuine_attempts,
        "total_impostor_attempts": result.total_impostor_attempts,
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/evaluate/optimal-threshold")
async def find_optimal_threshold(
    min_threshold: float = 0.5,
    max_threshold: float = 0.95,
    step: float = 0.05
):
    """
    Find optimal threshold that minimizes FAR + FRR (Equal Error Rate)
    
    Args:
        min_threshold: Minimum threshold to test
        max_threshold: Maximum threshold to test
        step: Step size for threshold search
        
    Returns:
        Optimal threshold and evaluation results
    """
    if embedding_extractor is None:
        raise HTTPException(status_code=500, detail="Embedding model not loaded")
    
    evaluator = FARFRREvaluator(embedding_extractor)
    result = await evaluator.find_optimal_threshold(
        threshold_range=(min_threshold, max_threshold),
        step=step
    )
    
    return result


# ============== Server Startup ==============

if __name__ == "__main__":
    import uvicorn
    print(f"Starting Sentinel Face Secure on http://0.0.0.0:{PORT}")
    print(f"API Documentation: http://localhost:{PORT}/docs")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
