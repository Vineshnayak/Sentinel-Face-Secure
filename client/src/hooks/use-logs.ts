import { useQuery } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001";

interface LogResponse {
  id: string;
  userId?: string;
  timestamp: string;
  status: string;
  spoofScore?: string;
}

export function useLogs() {
  return useQuery({
    queryKey: ["logs"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/logs`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();
      return data.map((log: LogResponse) => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }));
    },
    refetchInterval: 5000,
  });
}

export function useAiSummary() {
  return useQuery({
    queryKey: ["ai-summary"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/insights/summary`);
      if (!res.ok) throw new Error("Failed to fetch AI summary");
      const data = await res.json();
      return data.insight;
    },
    enabled: false, // Only run when triggered
  });
}

export async function fetchAiAnalysis(logId: string) {
  const res = await fetch(`${API_BASE}/api/insights/analyze/${logId}`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to analyze log");
  const data = await res.json();
  return data.insight;
}
