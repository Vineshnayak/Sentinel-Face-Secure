# Sentinel Face Secure

![Language](https://img.shields.io/badge/Language-Python%20%7C%20TypeScript-blue)
![Framework](https://img.shields.io/badge/Framework-FastAPI%20%7C%20React-green)
![Database](https://img.shields.io/badge/Database-MongoDB-green)
![AI Model](https://img.shields.io/badge/Model-MobileNetV2%20CNN-orange)

Sentinel Face Secure is an identity security operations platform and facial authentication system. It leverages convolutional neural networks (CNNs) for face recognition, multi-modal liveness detection, and an integrated AI-driven security operations center (SOC) for automated threat analysis. The system architecture is optimized for deployment on resource-constrained edge devices while providing enterprise-grade security monitoring.

## System Architecture

The platform operates on a decoupled client-server architecture:

1. **Frontend (React/TypeScript)**: Handles user interaction, camera stream acquisition, and frame optimization before transmission.
2. **API Gateway (FastAPI)**: Validates requests and routes payloads to respective microservices for detection, liveness evaluation, and feature extraction.
3. **Computer Vision Engine**:
   - **Detection**: Utilizes Haar Cascades or YOLO-Nano for face localization.
   - **Feature Extraction**: Generates 128-dimensional embeddings using a customized MobileNetV2 architecture pretrained on ImageNet.
   - **Liveness Evaluation**: Evaluates temporal frame sequences for biological viability.
4. **Security Operations Center**: Integrates large language models (LLMs) via the Model Context Protocol (MCP) to autonomously evaluate authentication logs, assign risk scores, and generate security reports.
5. **Database Layer (MongoDB)**: Stores encrypted vector embeddings and immutable audit logs.

## Technical Specifications

### Facial Recognition
- **Architecture**: MobileNetV2 with a custom dense embedding layer (`Dropout -> Linear -> BatchNorm1d`).
- **Embedding Dimensions**: 128 (L2 Normalized).
- **Distance Metric**: Cosine Similarity.
- **Privacy**: Raw images are not persisted. Only mathematical vector embeddings are stored.
- **Storage Security**: Embeddings are encrypted at rest using AES-128 (Fernet).

### Liveness Detection
The system employs a weighted probabilistic model to mitigate presentation attacks:
- **Active Liveness**: Eye Aspect Ratio (EAR) monitoring for blink detection.
- **Passive Liveness**: Frame-to-frame pixel intensity difference for static media detection.
- **Spatial Variance**: Bounding box scale monitoring to track 3D head movement.
- **Artifact Analysis**: Laplacian variance and FFT analysis to detect screen refresh rates and compression artifacts inherent in replay attacks.

### AI Security SOC
- **Autonomous Monitoring**: Background daemon analyzing log streams for anomalous authentication patterns.
- **Risk Scoring Engine**: Algorithmic calculation of threat levels based on biometric confidence, liveness thresholds, and temporal login frequency.
- **Evaluation Pipeline**: MLOps framework testing the SOC agent against a ground-truth dataset of simulated intrusion attempts to benchmark false positive rates and analytical latency.
- **Reporting Engine**: Automated generation of PDF security compliance reports.

## Project Structure

```bash
sentinel-face-secure/
├── client/                     # Frontend Application
│   ├── src/                    # Source code (Components, Hooks, Pages)
│   ├── package.json            # Node dependencies
│   └── vite.config.ts          # Vite build configuration
│
├── server/                     # Backend API and AI Services
│   ├── main.py                 # FastAPI application entry point
│   ├── cnn_embedding.py        # CNN architecture definition
│   ├── liveness_detection.py   # Liveness evaluation algorithms
│   ├── autonomous_agent.py     # Background SOC monitoring daemon
│   ├── mcp_server.py           # Model Context Protocol integration
│   ├── database.py             # Asynchronous MongoDB client
│   ├── encryption.py           # Cryptographic utilities
│   ├── evals/                  # MLOps evaluation dataset and runners
│   └── requirements.txt        # Python dependencies
│
└── docs/                       # Technical documentation and reviews
```

## Installation and Configuration

### Requirements
- Node.js (v18 or higher)
- Python (3.9 or higher)
- MongoDB (v5.0 or higher)

### Environment Configuration
Create a `.env` file in the `server` directory:

```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017
DB_NAME=sentinel_face
ENCRYPT_EMBEDDINGS=true
USE_YOLO=false
GEMINI_API_KEY=your_api_key_here
```

### Server Execution
```bash
cd server
pip install -r requirements.txt
python main.py
```

### Client Execution
```bash
cd client
npm install
npm run dev
```

## License
MIT License
