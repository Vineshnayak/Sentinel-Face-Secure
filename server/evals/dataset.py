import json
from datetime import datetime, timedelta

# Synthetic scenarios for evaluating the AI agent's reasoning.
GOLDEN_DATASET = [
    {
        "id": "eval_001",
        "description": "Standard successful login from known device",
        "log": {
            "timestamp": (datetime.now() - timedelta(minutes=5)).isoformat(),
            "status": "success",
            "device": "MacBook Pro",
            "os": "macOS",
            "browser": "Chrome",
            "ipAddress": "192.168.1.10",
            "location": "New York, USA",
            "confidenceScore": 98.5,
            "livenessScore": 99.1,
            "riskScore": 5,
            "riskLevel": "LOW"
        },
        "ground_truth_is_threat": False
    },
    {
        "id": "eval_002",
        "description": "Obvious spoofing attempt with low liveness",
        "log": {
            "timestamp": (datetime.now() - timedelta(minutes=15)).isoformat(),
            "status": "spoof",
            "device": "Unknown Device",
            "os": "Windows",
            "browser": "Firefox",
            "ipAddress": "185.15.22.1",
            "location": "Moscow, RU",
            "confidenceScore": 45.0,
            "livenessScore": 12.3,
            "riskScore": 95,
            "riskLevel": "HIGH"
        },
        "ground_truth_is_threat": True
    },
    {
        "id": "eval_003",
        "description": "Failed login, likely just a typo/bad lighting",
        "log": {
            "timestamp": (datetime.now() - timedelta(minutes=45)).isoformat(),
            "status": "failed",
            "device": "iPhone 13",
            "os": "iOS",
            "browser": "Safari",
            "ipAddress": "10.0.0.55",
            "location": "London, UK",
            "confidenceScore": 75.0,
            "livenessScore": 90.0,
            "riskScore": 40,
            "riskLevel": "LOW"
        },
        "ground_truth_is_threat": False
    },
    {
        "id": "eval_004",
        "description": "High risk anomaly, perfect match but anomalous IP",
        "log": {
            "timestamp": (datetime.now() - timedelta(hours=2)).isoformat(),
            "status": "success",
            "device": "Linux Desktop",
            "os": "Linux",
            "browser": "Tor Browser",
            "ipAddress": "104.244.72.115",
            "location": "Unknown (Proxy)",
            "confidenceScore": 99.0,
            "livenessScore": 95.0,
            "riskScore": 85,
            "riskLevel": "HIGH"
        },
        "ground_truth_is_threat": True
    },
    {
        "id": "eval_005",
        "description": "Medium risk failed attempts from known IP",
        "log": {
            "timestamp": (datetime.now() - timedelta(hours=3)).isoformat(),
            "status": "failed",
            "device": "MacBook Pro",
            "os": "macOS",
            "browser": "Chrome",
            "ipAddress": "192.168.1.10",
            "location": "New York, USA",
            "confidenceScore": 60.0,
            "livenessScore": 85.0,
            "riskScore": 65,
            "riskLevel": "MEDIUM"
        },
        "ground_truth_is_threat": False
    }
]

def get_golden_dataset():
    return GOLDEN_DATASET
