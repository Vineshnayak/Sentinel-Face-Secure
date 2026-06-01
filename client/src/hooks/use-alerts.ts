import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001";
import { useToast } from "@/hooks/use-toast";

export interface AgentAlert {
  id: string;
  log_id: string;
  timestamp: string;
  severity: string;
  status: string;
  user: string;
  device: string;
  ip: string;
  analysis: string;
  action_taken: string;
  resolved: boolean;
}

export function useAlerts() {
  return useQuery({
    queryKey: ["agent-alerts"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/alerts`);
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json() as Promise<AgentAlert[]>;
    },
    refetchInterval: 10000, // Poll every 10 seconds for new AI alerts
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch(`${API_BASE}/api/alerts/${alertId}/resolve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to resolve alert");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-alerts"] });
      toast({
        title: "Alert Resolved",
        description: "The AI agent alert has been marked as resolved.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to resolve alert",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}
