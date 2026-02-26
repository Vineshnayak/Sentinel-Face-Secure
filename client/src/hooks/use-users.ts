import { useQuery } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001";

interface UserResponse {
  id: string;
  name: string;
  role: string;
  createdAt: string;
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/users`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return await res.json() as UserResponse[];
    },
    refetchInterval: 10000,
  });
}
