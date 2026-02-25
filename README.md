# Sentinel Face Secure - Advanced Biometric Authentication System

![Language](https://img.shields.io/badge/Language-Python%20%7C%20TypeScript-blue)
![Framework](https://img.shields.io/badge/Framework-FastAPI%20%7C%20React-green)
![Database](https://img.shields.io/badge/Database-MongoDB-green)
![AI Model](https://img.shields.io/badge/Model-MobileNetV2%20CNN-orange)
![Security](https://img.shields.io/badge/Security-Fernet%20Encryption-red)

**Sentinel Face Secure** is a state-of-the-art, privacy-focused facial authentication system designed for high-security enterprise environments. It leverages lightweight Convolutional Neural Networks (CNNs) for edge-compatible face recognition and implements a multi-modal liveness detection engine to prevent spoofing attacks.

---

## 📖 Table of Contents

- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [AI & Security Specifications](#-ai--security-specifications)
- [Project Structure](#-project-structure)
- [Installation Guide](#-installation-guide)
- [Configuration](#-configuration)
- [API Documentation](#-api-documentation)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Features

### 👤 Core Authentication
-   **Touchless Login**: Authenticate users instantly using just their face.
-   **Instant Enrollment**: Fast user registration process capturing multiple angles.
-   **Role-Based Access Control (RBAC)**: Distinct interfaces for Admin, Manager, Employee, and Guest.

### 🛡️ Advanced Security
-   **Multi-Modal Liveness Detection**:
   -   **Blink Detection**: Monitors Eye Aspect Ratio (EAR) to ensure user presence (Active Liveness).
   -   **Motion Analysis**: Analyzes temporal frame differences to detect static photo attacks (Passive Liveness).
   -   **Head Movement Tracking**: Verifies 3D face geometry changes via face size variance.
   -   **Video Spoofing Analysis**: Detects replay attacks and screen artifacts to prevent video playback spoofing.
-   **Zero-Knowledge Privacy**: Raw user photos are **never** stored. Only mathematical vector embeddings are saved.
-   **At-Rest Encryption**: All stored embeddings are encrypted using Fernet (AES-128) symmetric encryption.

### 📊 Monitoring & Analytics
-   **Real-Time Dashboard**: Live monitoring of system performance.
-   **Audit Logs**: Immutable history of all login attempts, including spoofing alerts.
-   **Performance Metrics**: Tracks discrimination latency, embedding time, and hardware utilization.

---

## 🏗 System Architecture

The system follows a modern decoupled **Client-Server** architecture.

1.  **Client (Frontend)**: Captures live video feed, handles user interaction, and sends optimized image frames to the server.
2.  **API Gateway (FastAPI)**: Validates requests and routes them to specific micro-services (Detection, Liveness, Embedding).
3.  **Processing Engine**:
   *   **Detection**: Locates face using Hybrid approach (YOLO-Nano for accuracy or Haar Cascades for speed).
   *   **Liveness**: Evaluates frame sequence for biological signs.
   *   **Embedding**: Extracts 128-dimensional vector using MobileNetV2.
4.  **Database Layer**: MongoDB stores user metadata and encrypted vector blobs.

---

## 💻 Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript | UI/UX and logic |
| **Build Tool** | Vite | High-performance frontend tooling |
| **Styling** | Tailwind CSS, Radix UI | Responsive and accessible design system |
| **Backend** | Python FastAPI | Async, high-performance API framework |
| **Database** | MongoDB (Motor) | Document store for flexible user data |
| **AI Model** | MobileNetV2 (PyTorch) | Lightweight CNN for feature extraction |
| **Computer Vision** | OpenCV, TorchVision | Image processing and transformation |
| **Security** | Cryptography (Fernet) | Symmetric encryption for data at rest |

---

## 🧠 AI & Security Specifications

### 1. Convolutional Neural Network (CNN)
We utilize a customized **MobileNetV2** architecture, finetuned for facial recognition:
*   **Backbone**: MobileNetV2 pretrained on ImageNet.
*   **Input**: 224x224 RGB Images.
*   **Custom Head**: Replaced standard classifier with a dense embedding layer.
   *   Structure: `Dropout(0.3) -> Linear(1280, 128) -> BatchNorm1d(128)`
*   **Output**: 128-dimensional float vector (L2 Normalized).
*   **Similarity Metric**: Cosine Similarity.

### 2. Enhanced Liveness Engine
The `EnhancedLivenessDetector` calculates a weighted probability score based on:
*   **Blink Score** (weight: 0.25): Uses `scipy.spatial` distance on eye landmarks.
*   **Motion Score** (weight: 0.25): Calculates pixel intensity changes between frames.
*   **Head Movement** (weight: 0.20): Monitors bounding box scale variance.
*   **Video Spoofing Analysis** (weight: 0.30): Detects replay attacks and screen artifacts.
*   **Threshold**: A combined score < 0.15 triggers a spoofing alert.

---

## 📂 Project Structure

```bash
sentinel-face-secure/
├── client/                         # --- Frontend Application ---
│   ├── src/
│   │   ├── components/             # Reusable UI (Forms, Charts, Camera)
│   │   ├── hooks/                  # Logic hooks (useAuth, useCamera)
│   │   ├── pages/                  # Route Views
│   │   │   ├── Landing.tsx         # Home/Welcome page
│   │   │   ├── Login.tsx           # Face Authentication page
│   │   │   ├── Register.tsx        # User Enrollment page
│   │   │   └── Dashboard.tsx       # Main User/Admin Interface
│   │   ├── lib/                    # API clients & Utilities
│   │   └── App.tsx                 # Main Component
│   ├── package.json
│   └── vite.config.ts
│
├── server/                         # --- Backend Application ---
│   ├── main.py                     # API Entry Point & Routes
│   ├── cnn_embedding.py            # MobileNetV2 Model Definition
│   ├── liveness_detection.py       # Anti-Spoofing & Blink Logic
│   ├── yolo_detector.py            # YOLO-Nano Face Detector
│   ├── encryption.py               # Fernet Encryption Utils
│   ├── database.py                 # MongoDB Connection Wrapper
│   ├── models.py                   # Pydantic Data Schemas
│   ├── metrics.py                  # System Performance Monitor
│   ├── lfw_evaluation.py           # Evaluation Scripts
│   ├── requirements.txt
│   └── haarcascade_*.xml           # OpenCV Cascades
│
└── README.md                       # Documentation
```

---

## 🛠 Installation Guide

### Prerequisites
*   Node.js v18+
*   Python 3.9+
*   MongoDB v5.0+

### Step 1: Backend Setup
1.  Navigate to the server directory:
   ```bash
   cd server
   ```
2.  Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3.  Create a `.env` file (see [Configuration](#-configuration)).
4.  Start the FastAPI server:
   ```bash
   python main.py
   ```
   _Server will start at `http://localhost:5000`._

### Step 2: Frontend Setup
1.  Open a new terminal and navigate to the client directory:
   ```bash
   cd client
   ```
2.  Install Node dependencies:
   ```bash
   npm install
   ```
3.  Start the development server:
   ```bash
   npm run dev
   ```
   _App will be accessible at `http://localhost:5173`._

---

## ⚙ Configuration

Create a `.env` file in the `server` directory with the following variables:

```env
# Server
PORT=5000
FRONTEND_DIR=../client/dist

# Database
MONGODB_URI=mongodb://localhost:27017
DB_NAME=sentinel_face

# AI & Security
ENCRYPT_EMBEDDINGS=true       # Encrypt vectors in DB
USE_YOLO=false                # Set true for higher accuracy (slower)
```

---

## 📖 API Documentation

### Authentication
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/enroll` | Enroll a new user. Requires name, role, and 15 face images. |
| `POST` | `/api/verify` | Authenticate a user. Requires live image frames. |

### System & Users
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/users` | List all enrolled users (Admin). |
| `GET` | `/api/logs` | Retrieve authentication logs and security alerts. |
| `GET` | `/api/system/metrics` | Get CPU/RAM usage and inference latency. |
| `GET` | `/api/health` | Check database and model status. |

---

## 🔧 Troubleshooting

### "Video device not found"
Ensure your browser has permission to access the camera. Check `chrome://settings/content/camera`.

### "Model not loaded"
The first run requires downloading pretrained weights. Ensure you have an active internet connection when running `python main.py` for the first time.

### "MongoDB Connection Failed"
Ensure your local MongoDB service is running.
*   **Mac**: `brew services start mongodb-community`
*   **Windows**: `net start MongoDB`

---

## 📄 License
This project is licensed under the MIT License.
