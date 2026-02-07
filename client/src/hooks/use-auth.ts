import { useMutation } from "@tanstack/react-query";
import { api, type EnrollRequest, type VerifyRequest, type VerifyResponse } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// Helper to construct full API URL
const API_URL = (path: string) => path;

export function useEnroll() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async (data: EnrollRequest) => {
      // Validate with Zod before sending
      const validated = api.auth.enroll.input.parse(data);
      
      const res = await fetch(API_URL(api.auth.enroll.path), {
        method: api.auth.enroll.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to enroll");
      }

      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Enrollment Successful",
        description: "Your face data has been securely registered.",
        variant: "default", // Using default for success in dark theme
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
    mutationFn: async (data: VerifyRequest): Promise<VerifyResponse> => {
      const validated = api.auth.verify.input.parse(data);
      
      const res = await fetch(API_URL(api.auth.verify.path), {
        method: api.auth.verify.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (res.status === 401) {
        throw new Error("Face not recognized or spoof detected");
      }

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Verification failed");
      }

      return await res.json();
    },
  });
}
