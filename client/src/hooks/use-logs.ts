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
