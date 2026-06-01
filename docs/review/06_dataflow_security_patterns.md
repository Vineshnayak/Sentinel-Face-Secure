# Data Flow, Security, & Design Patterns — Sentinel Face Secure

> **Purpose**: Detailed analysis of data flows, security mechanisms, design patterns used, and edge deployment considerations.

---

## 1. End-to-End Data Flow

### 1.1 Enrollment Flow

```
User (Browser)                    FastAPI Server                     MongoDB
     │                                 │                               │
     │  1. POST /api/enroll            │                               │
     │  { name, role, images[15] }     │                               │
     │ ──────────────────────────────► │                               │
     │                                 │  2. Check duplicate user      │
     │                                 │ ──────────────────────────────►│
     │                                 │ ◄──────────────────────────────│
     │                                 │                               │
     │                                 │  3. For each image (×15):     │
     │                                 │    base64 → OpenCV image      │
     │                                 │    detect_face() → face ROI   │
     │                                 │    • Haar Cascade / YOLO      │
     │                                 │    • Masked face enhancement  │
     │                                 │    extract_embedding()        │
     │                                 │    • MobileNetV2 → 128-D vec  │
     │                                 │    • L2 normalize             │
     │                                 │                               │
     │                                 │  4. Average 15 embeddings     │
     │                                 │    np.mean(embeddings, axis=0)│
     │                                 │    L2 normalize final vector  │
     │                                 │                               │
     │                                 │  5. Encrypt embedding          │
     │                                 │    PBKDF2 → Fernet key        │
     │                                 │    AES-128 encrypt             │
     │                                 │    base64 encode               │
     │                                 │                               │
     │                                 │  6. Store to MongoDB           │
     │                                 │  { name, role, encrypted_emb} │
     │                                 │ ──────────────────────────────►│
     │                                 │                               │
     │  7. Return { id, name, role }   │                               │
     │ ◄────────────────────────────── │                               │
```

**Key Privacy Point**: Between Step 3 and Step 6, the raw images are processed in-memory only. They are **never** written to disk or database. Only the encrypted mathematical embedding is persisted.

### 1.2 Verification Flow

```
User (Browser)                    FastAPI Server                     MongoDB
     │                                 │                               │
     │  1. Capture 12 frames (1.4s)    │                               │
     │  POST /api/verify               │                               │
     │  { image, images[12] }          │                               │
     │ ──────────────────────────────► │                               │
     │                                 │                               │
     │                                 │  2. BLINK DETECTION            │
     │                                 │    Analyze 12 frames for EAR   │
     │                                 │    Count blink transitions     │
     │                                 │                               │
     │                                 │  3. LIVENESS DETECTION (4x)    │
     │                                 │    Blink (0.25) + Motion (0.25)│
     │                                 │    + Head (0.20) + Video (0.30)│
     │                                 │    ► If score < 0.15 → REJECT  │
     │                                 │    ► If video spoof → LOG+REJECT│
     │                                 │                               │
     │                                 │  4. FACE DETECTION             │
     │                                 │    detect_face_with_retry()    │
     │                                 │    Max 15 attempts × 2s delay  │
     │                                 │    ► Ensures single face in frame│
     │                                 │                               │
     │                                 │  5. EMBEDDING EXTRACTION       │
     │                                 │    MobileNetV2 → 128-D vector  │
     │                                 │                               │
     │                                 │  6. SIMILARITY MATCHING        │
     │                                 │    Load ALL users from DB      │
     │                                 │ ◄─────────────────────────────►│
     │                                 │    Decrypt each embedding      │
     │                                 │    cosine_similarity(new, stored)│
     │                                 │                               │
     │                                 │  7. THRESHOLD CHECK            │
     │                                 │    threshold = 0.85            │
     │                                 │    margin = 0.08               │
     │                                 │    ► Accept if clear winner    │
     │                                 │    ► Reject if ambiguous       │
     │                                 │                               │
     │                                 │  8. AUDIT LOG                  │
     │                                 │    Insert log with full details│
     │                                 │ ──────────────────────────────►│
     │                                 │                               │
     │  9. Return VerifyResponse       │                               │
     │  { verified, user, metrics }    │                               │
     │ ◄────────────────────────────── │                               │
     │                                 │                               │
     │  10. Navigate to Dashboard      │                               │
     │  /dashboard/{role}              │                               │
```

---

## 2. Security Analysis

### 2.1 Threat Model & Countermeasures

| Threat | Attack Vector | Countermeasure | Module |
|--------|---------------|----------------|--------|
| **Photo Attack** | Holding a printed photo | Motion detection (no movement) + Blink detection (no blinks) | `liveness_detection.py` |
| **Video Replay** | Playing a recorded video | Video spoofing detection (screen artifacts, LBP texture, FFT patterns) | `VideoSpoofingDetector` |
| **Mask + Still Photo** | Photo of person wearing mask | Masked face handler detects mask → focuses on upper face | `masked_face_handler.py` |
| **Data Breach** | Compromised database | Fernet AES-128 encryption on all embeddings | `encryption.py` |
| **Impersonation** | Similar-looking person | Margin check: best match must be >0.08 above second best | `main.py` L1030 |
| **Brute Force Key** | Cracking encryption key | PBKDF2 with 480,000 SHA-256 iterations | `encryption.py` |
| **Multiple Faces** | Two people in frame | Retry mechanism (15 attempts) waits for single face | `detect_face_with_retry()` |

### 2.2 Encryption Pipeline Detail

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Passphrase  │────►│   PBKDF2     │────►│  Fernet Key  │────►│  Fernet      │
│  (env file)  │     │  SHA256      │     │  (32 bytes)  │     │  Cipher      │
│              │     │  480K iters  │     │  base64url   │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                      │
┌──────────────┐                                               ┌──────▼───────┐
│  Embedding   │────► .tobytes() ──────────────────────────────►│  .encrypt()  │
│  (128 × f32) │     (512 bytes)                                │  AES-CBC +   │
│  numpy array │                                                │  HMAC-SHA256 │
└──────────────┘                                               └──────┬───────┘
                                                                      │
                                                               ┌──────▼───────┐
                                                               │  base64      │
                                                               │  encoded     │
                                                               │  string      │──► MongoDB
                                                               └──────────────┘
```

### 2.3 Privacy-by-Design Properties

1. **Zero-Knowledge Storage**: Database contains `name + role + encrypted_embedding + timestamp`. No biometric imagery exists in the system.
2. **In-Memory Processing**: Face images exist only in RAM during the API request lifecycle. They are garbage collected after the response.
3. **Authenticated Encryption**: Fernet combines AES-CBC with HMAC-SHA256 — any tampering with the stored data is detectable.
4. **Key Isolation**: The encryption key is derived from a passphrase stored in `.encryption_key` (excluded from `.gitignore`), never hardcoded.

---

## 3. Design Patterns Used

### 3.1 Singleton Pattern
- **`Database`** class (class-level state)
- **`EmbeddingEncryptor._instance`** (one Fernet cipher instance)
- **`_metrics_tracker`** module-level singleton

### 3.2 Factory Pattern
- `load_embedding_model()` → creates `CNNEmbeddingExtractor`
- `create_liveness_detector()` → creates `EnhancedLivenessDetector`
- `create_masked_face_handler()` → creates `MaskedFaceHandler`
- `create_quantized_extractor()` → creates `QuantizedEmbeddingExtractor`
- `get_yolo_detector()` → creates `YOLOFaceDetector`

### 3.3 Strategy Pattern
- **Face Detection**: Configurable between YOLO-Nano and Haar Cascade via `USE_YOLO` flag
- **Embedding Model**: Base extractor vs. Quantized extractor via `USE_QUANTIZATION` flag
- **Similarity Method**: Cosine vs. Euclidean via `method` parameter

### 3.4 Decorator/Wrapper Pattern
- `QuantizedEmbeddingExtractor` wraps `CNNEmbeddingExtractor` — transparent quantization
- `PerformanceMonitor` context manager wraps any operation with timing

### 3.5 Observer Pattern
- Frontend: `authUserChanged` custom event for cross-component authentication state
- `StorageEvent` listener for cross-tab synchronization

---

## 4. Edge Deployment Considerations

### 4.1 Model Optimization

| Metric | Base Model | Quantized |
|--------|-----------|-----------|
| **Size** | ~13 MB | ~3.3 MB |
| **Precision** | FP32 | INT8 |
| **Compression** | 1.0× | 4.0× |
| **Accuracy Loss** | Baseline | < 1% |
| **Inference Speed** | Baseline | ~2× faster |

### 4.2 Hardware Utilization Tracking

The `metrics.py` module monitors:
- **Detection Latency**: Haar Cascade typically ~5-15ms; YOLO ~20-50ms
- **Embedding Latency**: MobileNetV2 inference ~30-80ms (CPU), ~5-10ms (GPU)
- **Total E2E Latency**: Full verification pipeline ~200-800ms
- **Memory Usage**: Process RSS via `psutil`
- **CPU Usage**: Per-process CPU % via `psutil`

### 4.3 Configurable Processing

All compute-intensive features are configurable via environment variables:

```env
USE_YOLO=false           # Disable YOLO for CPU-only devices
USE_QUANTIZATION=true    # Enable 8-bit quantization
ENCRYPT_EMBEDDINGS=true  # Can disable for benchmarking
```

---

## 5. Client-Server Communication

### 5.1 Request/Response Sizes

| API | Request Size | Response Size |
|-----|-------------|---------------|
| `POST /api/enroll` | ~1.5 MB (15 JPEG base64) | ~200 bytes |
| `POST /api/verify` | ~600 KB (12 JPEG base64) | ~500 bytes |
| `GET /api/logs` | N/A | ~10 KB (50 logs) |
| `GET /api/users` | N/A | ~2 KB |
| `GET /api/system/metrics` | N/A | ~500 bytes |

### 5.2 CORS Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 5.3 Frontend State Management

- **React Query** (`@tanstack/react-query`) for API data fetching and caching
- **localStorage** for authenticated user session (name, role, ID)
- **Custom Events** (`authUserChanged`) for same-tab state synchronization
- **StorageEvent** listener for cross-tab session handling

---

## 6. Database Schema (MongoDB)

### 6.1 Users Collection

```json
{
  "_id": "ObjectId('...')",
  "name": "John Doe",
  "role": "employee",
  "embedding": "gAAAAABnJF...base64_encrypted_string...",
  "embedding_dim": 128,
  "createdAt": "ISODate('2026-03-26T...')"
}
```

### 6.2 Logs Collection

```json
{
  "_id": "ObjectId('...')",
  "userId": "ObjectId('...')" or null,
  "status": "success | failed | spoof | liveness_failed | no_face",
  "confidence": "0.8721",
  "timestamp": "ISODate('2026-03-26T...')",
  "details": "Match: John Doe, similarity: 0.8721, liveness_score: 0.451, ..."
}
```

### 6.3 Status Values

| Status | Meaning |
|--------|---------|
| `success` | User verified and authenticated |
| `failed` | Similarity below threshold or margin check failed |
| `spoof` | Video replay/spoofing detected |
| `liveness_failed` | Liveness score below 0.15 |
| `no_face` | No face detected after retries |
| `embedding_failed` | CNN could not extract embedding |

---

## 7. Testing & Evaluation

### 7.1 LFW Evaluation

The project includes LFW (Labeled Faces in the Wild) evaluation scripts (`lfw_evaluation.py`, `lfw_evaluation_cnn.ipynb`) for benchmarking the CNN model against the standard face verification benchmark.

### 7.2 FAR/FRR Live Evaluation

Available via REST API during production:
- `GET /api/evaluate/far-frr?threshold=0.75`
- `GET /api/evaluate/optimal-threshold?min_threshold=0.5&max_threshold=0.95&step=0.05`

### 7.3 Health Monitoring

```python
@app.get("/api/health")
async def health_check():
    db = Database.get_db()
    await db.command("ping")          # Verify MongoDB
    model_status = "loaded" if embedding_extractor else "not loaded"
    return {"status": "healthy", "database": "connected", "model": model_status}
```

---

## 8. Running the System

### Backend
```bash
cd server
pip install -r requirements.txt
python main.py
# Server starts at http://localhost:5001
# Auto-generated API docs at http://localhost:5001/docs
```

### Frontend
```bash
npm install      # From project root
npm run dev      # Starts Vite dev server at http://localhost:5173
```

### Prerequisites
- Python 3.9+
- Node.js 18+
- MongoDB 5.0+ running on `localhost:27017`
- Webcam-enabled browser (Chrome recommended)
