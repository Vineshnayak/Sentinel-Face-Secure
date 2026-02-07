import { useQuery } from "@tanstack/react-query";
import { api, type Log } from "@shared/routes";

export function useLogs() {
  return useQuery({
    queryKey: [api.logs.list.path],
    queryFn: async () => {
      const res = await fetch(api.logs.list.path);
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();
      return api.logs.list.responses[200].parse(data);
    },
    refetchInterval: 5000, // Real-time-ish updates for admin dashboard
  });
}
