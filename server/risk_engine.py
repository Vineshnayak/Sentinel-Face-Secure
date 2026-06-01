from datetime import datetime
from typing import Optional, Dict, Any

class RiskEngine:
    def __init__(self, logs_collection):
        self.logs_collection = logs_collection

    async def calculate_risk(
        self,
        user_id: Optional[str],
        status: str,
        liveness_score: float,
        confidence_score: float,
        device: Optional[str],
        ip_address: Optional[str],
        location: Optional[str]
    ) -> Dict[str, Any]:
        """
        Calculates a risk score from 0-100 based on context and history.
        Returns a dictionary with 'riskScore' and 'riskLevel'.
        """
        risk_score = 0

        # 1. Biometric Borderline Rules
        if status == "spoof" or status == "spoof_detected":
            risk_score = 100
        else:
            if liveness_score and 0.15 <= liveness_score < 0.5:
                risk_score += 30
            if confidence_score and 0.85 <= confidence_score < 0.90:
                risk_score += 20

        # 2. Behavioral Rules (Time of day)
        current_hour = datetime.now().hour
        # If between 12 AM and 5 AM
        if 0 <= current_hour < 5:
            risk_score += 15

        # Query recent logs for velocity and familiarity checks
        if ip_address or device:
            one_hour_ago = datetime.now().timestamp() - 3600
            # Need to compare with datetime objects in DB
            from datetime import timedelta
            one_hour_ago_dt = datetime.now() - timedelta(hours=1)
            
            recent_failures = await self.logs_collection.count_documents({
                "$or": [{"ipAddress": ip_address}, {"device": device}],
                "status": {"$in": ["failed", "no_face", "liveness_failed", "spoof"]},
                "timestamp": {"$gte": one_hour_ago_dt}
            })
            
            if recent_failures >= 3:
                risk_score += 40

        # 3. Contextual / Familiarity Rules
        if user_id:
            # Check if this device is new for the user
            if device:
                device_history = await self.logs_collection.find_one({
                    "userId": user_id,
                    "device": device,
                    "status": "success"
                })
                if not device_history:
                    risk_score += 20
                    
            # Check if location is new for the user
            if location:
                location_history = await self.logs_collection.find_one({
                    "userId": user_id,
                    "location": location,
                    "status": "success"
                })
                if not location_history:
                    risk_score += 20

        # Cap at 100
        risk_score = min(risk_score, 100)

        # Categorize
        if risk_score < 30:
            risk_level = "LOW"
        elif risk_score < 70:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

        return {
            "riskScore": risk_score,
            "riskLevel": risk_level
        }
