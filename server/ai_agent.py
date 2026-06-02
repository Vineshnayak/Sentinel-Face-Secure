import os
from groq import AsyncGroq
from typing import List, Dict, Any

class SecurityAIAgent:
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY is not set in environment variables.")
        self.client = AsyncGroq(api_key=api_key)
        # Using llama-3.3-70b-versatile for fast and capable analysis
        self.model = 'llama-3.3-70b-versatile'

    async def generate_daily_summary(self, recent_logs: List[Dict[str, Any]]) -> str:
        """Generates a summary of the last 24 hours of logs."""
        
        # Format the logs into a concise string to avoid massive context
        log_summary = "Recent Logs (Last 24 Hours):\n"
        log_summary += "Time | Status | Device | IP | Risk Score\n"
        
        # Limit to 100 most recent logs to stay well within context
        for log in recent_logs[:100]:
            time_str = log.get('timestamp', '').strftime('%Y-%m-%d %H:%M:%S') if hasattr(log.get('timestamp'), 'strftime') else str(log.get('timestamp', 'Unknown'))
            status = log.get('status', 'Unknown')
            device = log.get('device') or log.get('os') or log.get('browser') or 'Unknown'
            ip = log.get('ipAddress', 'Unknown')
            risk = log.get('riskScore', 0)
            log_summary += f"{time_str} | {status} | {device} | {ip} | {risk}\n"

        prompt = f"""
        You are an expert Security Operations Center (SOC) analyst for an Identity Security Platform.
        Review the following authentication logs from the last 24 hours.
        
        {log_summary}
        
        Provide a concise summary of the security posture, highlighting any unusual activity, spoofing attempts, or brute-force patterns.
        Format your response in Markdown. Use short paragraphs or bullet points.
        Suggest 1-2 actionable security policy improvements based on the data.
        Keep the entire response under 250 words.
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error generating AI summary: {e}")
            return "Unable to generate AI summary at this time. Please check your API key and connection."

    async def analyze_log(self, log_details: Dict[str, Any], user_history: List[Dict[str, Any]] = None) -> str:
        """Provides an in-depth analysis of a specific (likely high-risk) log event."""
        
        prompt = f"""
        You are an expert SOC analyst investigating a specific authentication event that was flagged by our Risk Engine.
        
        Event Details:
        - Time: {log_details.get('timestamp')}
        - Status: {log_details.get('status')}
        - Device: {log_details.get('device')} ({log_details.get('os')}, {log_details.get('browser')})
        - IP Address: {log_details.get('ipAddress')}
        - Location: {log_details.get('location')}
        - Biometric Match Confidence: {log_details.get('confidenceScore')}
        - Liveness Score: {log_details.get('livenessScore')}
        - Assigned Risk Score: {log_details.get('riskScore')} / 100 ({log_details.get('riskLevel')})
        """
        
        if user_history and len(user_history) > 0:
            prompt += f"\nNote: This IP/Device has had {len(user_history)} recent failed attempts in the last hour.\n"
            
        prompt += """
        Explain in simple terms why this event is risky (if it is), what an attacker might be trying to do, and recommend an immediate response action for the administrator.
        Format your response in Markdown. Keep it concise, under 150 words.
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error generating AI log analysis: {e}")
            return "Unable to generate analysis for this event."
