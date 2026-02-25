"""
Performance Metrics Module
Provides system performance monitoring for edge deployment
Tracks detection, embedding, and system metrics
"""

import time
import psutil
import os
import numpy as np
from typing import Dict
from datetime import datetime
from dataclasses import dataclass
import threading


@dataclass
class PerformanceMetrics:
    """Performance metrics snapshot"""
    timestamp: datetime
    detection_time_ms: float
    embedding_time_ms: float
    total_latency_ms: float
    memory_usage_mb: float
    cpu_usage_percent: float
    
    def to_dict(self) -> Dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "detection_time_ms": round(self.detection_time_ms, 2),
            "embedding_time_ms": round(self.embedding_time_ms, 2),
            "total_latency_ms": round(self.total_latency_ms, 2),
            "memory_usage_mb": round(self.memory_usage_mb, 2),
            "cpu_usage_percent": round(self.cpu_usage_percent, 2)
        }


class MetricsTracker:
    """Track and manage performance metrics"""
    
    def __init__(self):
        self.detection_times = []
        self.embedding_times = []
        self.total_latencies = []
        self._lock = threading.Lock()
        
    def record_detection(self, time_ms: float):
        with self._lock:
            self.detection_times.append(time_ms)
            if len(self.detection_times) > 100:
                self.detection_times.pop(0)
    
    def record_embedding(self, time_ms: float):
        with self._lock:
            self.embedding_times.append(time_ms)
            if len(self.embedding_times) > 100:
                self.embedding_times.pop(0)
    
    def record_total_latency(self, time_ms: float):
        with self._lock:
            self.total_latencies.append(time_ms)
            if len(self.total_latencies) > 100:
                self.total_latencies.pop(0)
    
    def get_average_metrics(self) -> Dict:
        with self._lock:
            return {
                "avg_detection_ms": round(np.mean(self.detection_times), 2) if self.detection_times else 0,
                "avg_embedding_ms": round(np.mean(self.embedding_times), 2) if self.embedding_times else 0,
                "avg_total_latency_ms": round(np.mean(self.total_latencies), 2) if self.total_latencies else 0,
                "max_detection_ms": round(np.max(self.detection_times), 2) if self.detection_times else 0,
                "max_embedding_ms": round(np.max(self.embedding_times), 2) if self.embedding_times else 0,
                "max_total_latency_ms": round(np.max(self.total_latencies), 2) if self.total_latencies else 0,
                "min_detection_ms": round(np.min(self.detection_times), 2) if self.detection_times else 0,
                "min_embedding_ms": round(np.min(self.embedding_times), 2) if self.embedding_times else 0,
                "min_total_latency_ms": round(np.min(self.total_latencies), 2) if self.total_latencies else 0,
                "total_operations": len(self.total_latencies)
            }
    
    def reset(self):
        with self._lock:
            self.detection_times.clear()
            self.embedding_times.clear()
            self.total_latencies.clear()


def get_system_metrics() -> Dict:
    """Get current system metrics"""
    process = psutil.Process(os.getpid())
    
    memory_info = process.memory_info()
    memory_mb = memory_info.rss / (1024 * 1024)
    
    cpu_percent = process.cpu_percent(interval=0.1)
    
    return {
        "memory_mb": round(memory_mb, 2),
        "cpu_percent": round(cpu_percent, 2),
        "memory_available_mb": round(psutil.virtual_memory().available / (1024 * 1024), 2),
        "cpu_count": psutil.cpu_count(),
        "process_threads": process.num_threads()
    }


class PerformanceMonitor:
    """Context manager for performance monitoring"""
    
    def __init__(self, tracker: MetricsTracker, operation_name: str):
        self.tracker = tracker
        self.operation_name = operation_name
        self.start_time = 0
        self.end_time = 0
        
    def __enter__(self):
        self.start_time = time.time()
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.time()
        elapsed_ms = (self.end_time - self.start_time) * 1000
        
        if "detection" in self.operation_name.lower():
            self.tracker.record_detection(elapsed_ms)
        elif "embedding" in self.operation_name.lower():
            self.tracker.record_embedding(elapsed_ms)
        else:
            self.tracker.record_total_latency(elapsed_ms)
        
        return False


_metrics_tracker = MetricsTracker()


def get_metrics_tracker() -> MetricsTracker:
    return _metrics_tracker


def measure_operation(tracker: MetricsTracker, operation_name: str):
    def decorator(func):
        def wrapper(*args, **kwargs):
            with PerformanceMonitor(tracker, operation_name):
                return func(*args, **kwargs)
        return wrapper
    return decorator


import numpy as np
