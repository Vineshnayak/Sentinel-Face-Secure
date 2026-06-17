import asyncio
import time
import json
import os
from groq import AsyncGroq
from evals.dataset import get_golden_dataset

class AgentEvaluator:
    def __init__(self, api_key: str = None):
        key = api_key or os.getenv("GROQ_API_KEY")
        self.has_key = bool(key)
        if self.has_key:
            self.client = AsyncGroq(api_key=key)
        else:
            self.client = None
            
        self.model = 'llama-3.3-70b-versatile'

    async def evaluate_log(self, log_data: dict) -> bool:
        """
        Runs the LLM as a judge. Asks the model to analyze the log and strictly 
        output a JSON boolean indicating if it's a threat.
        """
        prompt = f"""
        You are evaluating an authentication log event.
        
        Log Details:
        {json.dumps(log_data, indent=2)}
        
        Determine if this event represents a legitimate security threat (e.g., spoofing, unauthorized access, brute force).
        A standard failed login due to low confidence is NOT necessarily a threat unless it has anomalous context (like Tor).
        A 'spoof' status is ALWAYS a threat.
        
        Respond ONLY with a valid JSON object in this format:
        {{"is_threat": true}} or {{"is_threat": false}}
        """
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1
            )
            # Clean up markdown if present
            text = response.choices[0].message.content.replace("```json", "").replace("```", "").strip()
            result = json.loads(text)
            return result.get("is_threat", False)
        except Exception as e:
            print(f"Eval Error: {e}")
            return False

    async def run_benchmark(self) -> dict:
        if not self.has_key:
            raise ValueError("API Key is required to run evaluation")
            
        dataset = get_golden_dataset()
        results = {
            "total_evaluated": len(dataset),
            "correct_predictions": 0,
            "false_positives": 0,
            "false_negatives": 0,
            "average_latency_ms": 0,
            "accuracy_score": 0.0
        }
        
        total_latency = 0
        
        print("Starting AI Agent Benchmark...")
        for item in dataset:
            start_time = time.time()
            ai_prediction = await self.evaluate_log(item["log"])
            latency = (time.time() - start_time) * 1000
            total_latency += latency
            
            ground_truth = item["ground_truth_is_threat"]
            
            if ai_prediction == ground_truth:
                results["correct_predictions"] += 1
            elif ai_prediction and not ground_truth:
                results["false_positives"] += 1
            elif not ai_prediction and ground_truth:
                results["false_negatives"] += 1
                
            print(f"Eval '{item['id']}': Truth={ground_truth}, AI={ai_prediction} | Latency={int(latency)}ms")
            
        results["average_latency_ms"] = int(total_latency / max(1, len(dataset)))
        results["accuracy_score"] = round((results["correct_predictions"] / len(dataset)) * 100, 1)
        
        print(f"Benchmark Complete! Accuracy: {results['accuracy_score']}%")
        return results

# For CLI execution
if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    evaluator = AgentEvaluator()
    asyncio.run(evaluator.run_benchmark())
