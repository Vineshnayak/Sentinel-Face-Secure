# Sentinel Face Secure — Stepwise Implementation & Code Snippets

---

## Step 1: Database Connection (MongoDB Async)

MongoDB stores user embeddings and audit logs. Motor (async driver) ensures non-blocking I/O with FastAPI's event loop. Singleton class shares one connection across all requests.

```python
# server/database.py
class Database:
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None

    @classmethod
    async def connect(cls):
        cls.client = AsyncIOMotorClient(MONGODB_URI)
        cls.db = cls.client[DB_NAME]
        await cls.client.admin.command('ping')

    @classmethod
    def get_db(cls) -> AsyncIOMotorDatabase:
        if cls.db is None: raise RuntimeError("Database not connected.")
        return cls.db
```

---

## Step 2: CNN Model — MobileNetV2 Embedding Network

Pretrained MobileNetV2 backbone with a custom head that outputs a 128-D face embedding vector. The original ImageNet classifier is replaced with `Dropout → Linear(1280→128) → BatchNorm`.

```python
# server/cnn_embedding.py
class FaceEmbeddingModel(nn.Module):
    def __init__(self, embedding_dim=128):
        super().__init__()
        self.backbone = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
        num_features = self.backbone.classifier[1].in_features  # 1280
        self.backbone.classifier = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(num_features, embedding_dim),  # 1280 → 128
            nn.BatchNorm1d(embedding_dim)
        )
    def forward(self, x):
        return self.backbone(x)
```

---

## Step 3: Embedding Extraction & Similarity Matching

Face image is resized to 224×224, normalized with ImageNet stats, passed through the CNN. Output is L2-normalized so cosine similarity equals the dot product.

```python
# server/cnn_embedding.py
def extract_embedding(self, face_image):
    with torch.no_grad():
        tensor = self.preprocess_face(face_image)
        embedding = self.model(tensor)
        embedding = nn.functional.normalize(embedding, p=2, dim=1)
        return embedding.cpu().numpy().flatten()  # 128-D vector

def compute_similarity(self, emb1, emb2):
    dot = np.dot(emb1, emb2)
    return max(0.0, min(1.0, dot / (np.linalg.norm(emb1) * np.linalg.norm(emb2))))
```

---

## Step 4: Face Detection — Haar Cascade with YOLO Fallback

Detects the face region from camera frames. Tries YOLO-Nano if enabled, otherwise uses Haar Cascade with histogram equalization. Picks the largest face if multiple are found. Also handles masks/eyeglasses via CLAHE enhancement.

```python
# server/main.py
def detect_face(image, use_yolo=False):
    if use_yolo and yolo_detector and yolo_detector.is_loaded():
        bbox = yolo_detector.get_largest_face(image)
    if bbox is None:
        gray = cv2.equalizeHist(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY))
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.03,
                    minNeighbors=2, minSize=(30,30), maxSize=(500,500))
        if len(faces) > 1:
            faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
        bbox = faces[0]
    x, y, w, h = bbox
    face_region = image[y:y+h, x:x+w]
    if masked_face_handler:
        face_region, _ = masked_face_handler.preprocess_occluded_face(face_region)
    return face_region, bbox
```

---

## Step 5: Liveness Detection — 4-Factor Weighted Check

Prevents photo/video attacks using four checks combined with weights. Blink detection monitors eye openness across frames. Motion detector measures pixel changes. Head movement tracks bounding box size variance. Combined score must be ≥ 0.15.

```python
# server/liveness_detection.py
def check_liveness(self, image, frames=None, face_sizes=None):
    blink_count, blink_score = self.blink_detector.detect_blinks(frames)
    motion_score = self.motion_detector.detect_motion(frames)
    head_score = self.head_detector.detect_head_movement(face_sizes)
    is_live, spoof_score = self.video_spoof_detector.check_video_spoofing(
        face_region, frames)

    combined = (0.25*blink_score + 0.25*motion_score +
                0.20*head_score + 0.30*(1.0 - spoof_score))
    is_real = is_live and combined >= 0.15
    return LivenessResult(is_real=is_real, liveness_score=combined, ...)
```

---

## Step 6: Video Spoofing Detection — Anti-Replay

Detects recorded videos played on screens. Uses Laplacian variance for compression artifacts, Sobel gradients + FFT for screen refresh patterns, and motion consistency analysis for unnatural frame timing. Spoof score > 0.45 triggers rejection.

```python
# server/liveness_detection.py
def check_video_spoofing(self, face_region, frames=None):
    quality = 1.0 - self.analyze_face_quality(face_region)     # Laplacian
    artifact = self.detect_screen_artifacts(face_region)        # HSV + FFT
    edge = self.detect_face_edge_artifacts(face_region)         # Canny + Sobel
    temporal = self.analyze_motion_consistency(frames)           # Inter-frame

    spoof = 0.25*quality + 0.25*artifact + 0.20*edge + 0.30*temporal
    return (spoof <= 0.45), spoof  # True = live face
```

---

## Step 7: Encryption — AES-128 for Stored Embeddings

Embedding bytes are encrypted using Fernet (AES-CBC + HMAC-SHA256). Key is derived from a passphrase using PBKDF2 with 480K SHA-256 iterations. Raw face images are **never** saved — only the encrypted 128-D vector is stored.

```python
# server/encryption.py
class EmbeddingEncryptor:
    def __init__(self):
        kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32,
                          salt=b'sentinel_face_salt', iterations=480000)
        self.key = base64.urlsafe_b64encode(kdf.derive(PASSPHRASE.encode()))
        self.fernet = Fernet(self.key)

    def encrypt_embedding(self, embedding) -> str:
        return base64.b64encode(self.fernet.encrypt(embedding.tobytes())).decode()

    def decrypt_embedding(self, encrypted_str) -> bytes:
        return self.fernet.decrypt(base64.b64decode(encrypted_str.encode()))
```

---

## Step 8: User Enrollment — Register with 15 Face Images

Frontend captures 15 photos from different angles. Backend detects face in each, extracts embedding, averages all 15 embeddings, normalizes, encrypts, and stores in MongoDB. No raw images are persisted.

```python
# server/main.py — POST /api/enroll
@app.post("/api/enroll")
async def enroll_user(request: EnrollRequest):
    existing = await users_collection.find_one({"name": request.name})
    if existing: raise HTTPException(400, "User already exists")

    embeddings = []
    for img_b64 in all_images:
        face, _ = detect_face(base64_to_image(img_b64))
        if face is not None:
            emb = extract_embedding(face)
            if emb is not None: embeddings.append(emb)

    avg = np.mean(embeddings, axis=0)
    avg = avg / np.linalg.norm(avg)
    stored = encrypt_embedding(avg)

    await users_collection.insert_one({
        "name": request.name, "role": role.value,
        "embedding": stored, "createdAt": datetime.now()
    })
```

**Frontend — 15-image capture (Register.tsx):**
```tsx
const REQUIRED_IMAGES = 15;
const handleCapture = useCallback(() => {
  const imageSrc = webcamRef.current.getScreenshot();
  if (imageSrc) setCapturedImages(prev => [...prev, imageSrc]);
}, []);
// On submit: enrollMutation.mutate({ ...data, images: capturedImages });
```

---

## Step 9: Webcam Capture & Face Verification

Frontend auto-captures 12 frames over ~1.4 seconds for liveness analysis. Sends primary image + all frames to backend. Backend runs full pipeline: liveness → face detection → embedding → matching against all users → threshold + margin check.

**Frontend — capture and verify (Login.tsx):**
```tsx
const captureAndVerify = useCallback(async () => {
  const frames: string[] = [];
  for (let i = 0; i < 12; i++) {
    const frame = webcamRef.current.getScreenshot();
    if (frame) frames.push(frame);
    await new Promise(r => setTimeout(r, 120));
  }
  const result = await verifyMutation.mutateAsync({
    image: frames[0], images: frames
  });
  if (result.verified && result.user) {
    localStorage.setItem('authenticatedUser', JSON.stringify(result.user));
    setTimeout(() => setLocation(`/dashboard/${result.user.role}`), 1500);
  }
}, []);
```

**Backend — threshold & margin matching (main.py):**
```python
base_threshold = 0.85
base_margin = 0.08

for user in users:
    user_emb = decrypt_and_load(user)
    _, similarity = verify_embedding(embedding, user_emb)
    if similarity > best_similarity:
        second_best = best_similarity
        best_similarity, best_match = similarity, user

should_accept = (
    (best_similarity >= threshold and (best - second) >= margin) or
    (best_similarity >= threshold and second < threshold) or
    (best_similarity >= 0.90)
)
```

---

## Step 10: Role-Based Dashboard & Audit Logs

After successful verification, user is routed to `/dashboard/{role}`. Admin sees full stats + audit log table + user list. Manager sees team attendance. Employee sees personal profile. All auth attempts are logged to MongoDB with status, confidence, and timestamp.

```tsx
// client/src/pages/Dashboard.tsx
const renderView = () => {
  switch (role) {
    case 'admin':    return <AdminView />;    // Stats + logs + users
    case 'manager':  return <ManagerView />;  // Team + attendance
    case 'employee':
    case 'guest':
    default:         return <EmployeeView />; // Profile + clock in/out
  }
};
```

**Audit log entry (server):**
```python
log_doc = {
    "userId": str(best_match["_id"]),
    "status": "success",  # or failed / spoof / liveness_failed / no_face
    "confidence": str(similarity),
    "timestamp": datetime.now(),
    "details": f"Match: {name}, similarity: {similarity:.4f}"
}
await logs_collection.insert_one(log_doc)
```

---

## API Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/enroll` | Register user (name + role + 15 images) |
| `POST` | `/api/verify` | Authenticate (image + 12 frames for liveness) |
| `GET` | `/api/users` | List enrolled users |
| `GET` | `/api/logs` | Audit logs |
| `GET` | `/api/health` | DB + model status |
| `GET` | `/api/system/metrics` | Latency, CPU, RAM |
| `GET` | `/api/evaluate/far-frr` | FAR/FRR at threshold |
