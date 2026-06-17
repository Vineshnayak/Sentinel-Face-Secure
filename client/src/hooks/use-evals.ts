import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001";

export interface EvalResult {
  id: string;
  timestamp: string;
  metrics: {
    total_evaluated: number;
    correct_predictions: number;
    false_positives: number;
    false_negatives: number;
    average_latency_ms: number;
    accuracy_score: number;
  };
}

export function useEvals() {
  return useQuery({
    queryKey: ["ai-evals"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/evals/results`);
      if (!res.ok) throw new Error("Failed to fetch evaluation results");
      return res.json() as Promise<EvalResult[]>;
    },
  });
}

export function useRunEval() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const apiKey = localStorage.getItem("groq_api_key") || "";
      const res = await fetch(`${API_BASE}/api/evals/run`, {
        method: "POST",
        headers: {
          "X-Groq-Api-Key": apiKey
        }
      });
      if (!res.ok) throw new Error("Failed to run evaluation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-evals"] });
      toast({
        title: "Evaluation Complete",
        description: "The AI agent benchmark has successfully finished.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Evaluation Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}
