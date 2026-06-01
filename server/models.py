"""
Pydantic models for Sentinel Face Secure
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    EMPLOYEE = "employee"
    GUEST = "guest"


class LogStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    SPOOF = "spoof"
    LIVENESS_FAILED = "liveness_failed"
    NO_FACE = "no_face"


class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    role: UserRole


class UserCreate(UserBase):
    embedding: List[float]


class UserResponse(BaseModel):
    id: str
    name: str
    role: str
    createdAt: datetime
    
    class Config:
        from_attributes = True


class UserInDB(UserBase):
    id: Optional[str] = Field(None, alias="_id")
    embedding: List[float]
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        from_attributes = True


class LogBase(BaseModel):
    userId: Optional[str] = None
    status: LogStatus
    spoofScore: Optional[str] = None
    device: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    ipAddress: Optional[str] = None
    location: Optional[str] = None
    sessionId: Optional[str] = None
    confidenceScore: Optional[float] = None
    livenessScore: Optional[float] = None
    riskScore: Optional[int] = None
    riskLevel: Optional[str] = None


class LogCreate(LogBase):
    timestamp: datetime = Field(default_factory=datetime.now)


class LogResponse(BaseModel):
    id: str
    userId: Optional[str]
    timestamp: datetime
    status: str
    spoofScore: Optional[str]
    device: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    ipAddress: Optional[str] = None
    location: Optional[str] = None
    sessionId: Optional[str] = None
    confidenceScore: Optional[float] = None
    livenessScore: Optional[float] = None
    riskScore: Optional[int] = None
    riskLevel: Optional[str] = None
    
    class Config:
        from_attributes = True


class EnrollRequest(BaseModel):
    name: str
    role: str
    images: Optional[List[str]] = None
    video: Optional[str] = None  # Base64 encoded video
    frame_interval: Optional[float] = 0.5  # Extract frame every X seconds


class EnrollResponse(BaseModel):
    id: str
    name: str
    role: str
    createdAt: datetime


class VerifyRequest(BaseModel):
    image: str
    images: Optional[List[str]] = None
    sessionId: Optional[str] = None
    location: Optional[str] = None


class VerifyResponse(BaseModel):
    verified: bool
    user: Optional[UserResponse] = None
    status: str
    message: Optional[str] = None
    blinkCount: Optional[int] = None
    livenessScore: Optional[float] = None
    headMovementDetected: Optional[bool] = None
    videoSpoofDetected: Optional[bool] = None
    similarity: Optional[float] = None
    detectionTime: Optional[float] = None
    embeddingTime: Optional[float] = None
    totalLatency: Optional[float] = None


class HealthResponse(BaseModel):
    status: str
    database: str
    model: Optional[str] = None


class MessageResponse(BaseModel):
    message: str


class AIInsightResponse(BaseModel):
    insight: str
