import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface EnrollRequest {
  name: string;
  role: "admin" | "manager" | "employee" | "guest";
  images: string[];
}

interface UserResponse {
  id: string;
  name: string;
  role: string;
  createdAt: string;
}

interface VerifyResponse {
  verified: boolean;
  user?: Pick<UserResponse, "id" | "name" | "role">;
  status: string;
  message?: string;
  blinkCount?: number;
  livenessScore?: number;
  headMovementDetected?: boolean;
  similarity?: number;
  detectionTime?: number;
  embeddingTime?: number;
  totalLatency?: number;
  blink_count?: number;
  liveness_score?: number;
  head_movement_detected?: boolean;
  detection_time?: number;
  embedding_time?: number;
  total_latency?: number;
}

const API_ENDPOINTS = {
  enroll: `${API_BASE}/api/enroll`,
  verify: `${API_BASE}/api/verify`,
};

export function useEnroll() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async (data: EnrollRequest) => {
      const res = await fetch(API_ENDPOINTS.enroll, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || error.message || "Failed to enroll");
      }

      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Enrollment Successful",
        description: "Your face data has been securely registered.",
        variant: "default",
        className: "border-primary text-primary-foreground bg-primary",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Enrollment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useVerify() {
  return useMutation({
    mutationFn: async (data: { image: string; images?: string[] }): Promise<VerifyResponse> => {
      const res = await fetch(API_ENDPOINTS.verify, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || error.message || "Verification failed");
      }

      return await res.json();
    },
  });
}
