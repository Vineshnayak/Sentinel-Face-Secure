import asyncio
from datetime import datetime, timedelta
from database import Database, LOGS_COLLECTION
from ai_agent import SecurityAIAgent

ALERTS_COLLECTION = "agent_alerts"

class AutonomousSecurityAgent:
    def __init__(self, polling_interval_seconds: int = 60):
        self.polling_interval = polling_interval_seconds
        self.is_running = False
        self._task = None
        self.ai = SecurityAIAgent()

    def start(self):
        if not self.is_running:
            self.is_running = True
            self._task = asyncio.create_task(self._run_loop())
            print(f"Autonomous Security Agent started (polling every {self.polling_interval}s)")

    def stop(self):
        if self.is_running:
            self.is_running = False
            if self._task:
                self._task.cancel()
            print("Autonomous Security Agent stopped")

    async def _run_loop(self):
        while self.is_running:
            try:
                await self._check_for_threats()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Autonomous agent error: {e}")
            
            await asyncio.sleep(self.polling_interval)

    async def _check_for_threats(self):
        db = Database.get_db()
        logs_col = db[LOGS_COLLECTION]
        alerts_col = db[ALERTS_COLLECTION]

        # Find high/medium risk logs that haven't been reviewed by the agent
        unreviewed_threats = await logs_col.find({
            "riskLevel": {"$in": ["HIGH", "MEDIUM"]},
            "agent_reviewed": {"$ne": True}
        }).to_list(length=10)

        for log in unreviewed_threats:
            print(f"Agent detected threat: {log.get('_id')} - {log.get('riskLevel')}")
            
            # 1. Analyze the threat with AI
            analysis = await self.ai.analyze_log(log)
            
            # 2. Create an Alert Record
            alert = {
                "log_id": str(log.get("_id")),
                "timestamp": datetime.now(),
                "severity": log.get("riskLevel"),
                "status": log.get("status"),
                "user": log.get("userId", "Unknown"),
                "device": log.get("device", "Unknown"),
                "ip": log.get("ipAddress", "Unknown"),
                "analysis": analysis,
                "action_taken": "Alert Generated for SOC Review",
                "resolved": False
            }
            
            await alerts_col.insert_one(alert)
            
            # 3. Mark the log as reviewed so we don't process it again
            await logs_col.update_one(
                {"_id": log["_id"]},
                {"$set": {"agent_reviewed": True}}
            )
            
            print(f"Agent generated alert for {log.get('_id')}")

# Singleton instance
agent_instance = AutonomousSecurityAgent(polling_interval_seconds=30)
