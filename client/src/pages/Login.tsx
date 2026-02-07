import { useCallback, useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { Link, useLocation } from "wouter";
import { ArrowLeft, RefreshCw, AlertTriangle } from "lucide-react";
import { useVerify } from "@/hooks/use-auth";
import { ScannerOverlay } from "@/components/ScannerOverlay";
import { TechCard } from "@/components/TechCard";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function Login() {
  const webcamRef = useRef<Webcam>(null);
  const verifyMutation = useVerify();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  // Auto-scan logic
  const captureAndVerify = useCallback(async () => {
    if (!webcamRef.current) return;
    
    setStatus("scanning");
    const imageSrc = webcamRef.current.getScreenshot();
    
    if (!imageSrc) {
      setStatus("error");
      setMessage("Camera error");
      return;
    }

    try {
      const result = await verifyMutation.mutateAsync({ image: imageSrc });
      
      if (result.verified && result.user) {
        setStatus("success");
        setMessage(`Welcome, ${result.user.name}`);
        
        // Wait for success animation then redirect
        setTimeout(() => {
          // Default redirect based on role, or general dashboard
          const role = result.user?.role || 'guest';
          setLocation(`/dashboard/${role}`);
        }, 1500);
      } else {
        setStatus("error");
        setMessage(result.message || "Authentication failed");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Verification error");
    }
  }, [verifyMutation, setLocation]);

  // Initial auto-start after a delay
  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === 'idle') {
        captureAndVerify();
      }
    }, 2000); // Give user 2 seconds to settle
    return () => clearTimeout(timer);
  }, [status, captureAndVerify]);

  const handleManualRetry = () => {
    setRetryCount(c => c + 1);
    setStatus("idle");
    setMessage("");
    setTimeout(captureAndVerify, 500);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left Side - Instructions */}
        <div className="order-2 md:order-1 space-y-6">
          <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          
          <div>
            <h1 className="text-4xl font-display font-bold mb-2">System Access</h1>
            <p className="text-muted-foreground">
              Look directly at the camera. Ensure your face is well-lit and unobstructed. 
              The system will automatically scan your biometrics.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-card/50 border border-white/5 rounded-lg">
              <div className="bg-primary/20 p-2 rounded-md">
                <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">Active Liveness Check</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Our AI analyzes micro-movements to prevent spoofing attempts. Please remain still during the scan.
                </p>
              </div>
            </div>

            {status === 'error' && (
              <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-destructive">Verification Failed</h4>
                  <p className="text-xs text-muted-foreground mt-1">{message}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3 border-destructive/30 hover:bg-destructive/10 text-destructive hover:text-destructive"
                    onClick={handleManualRetry}
                  >
                    <RefreshCw className="w-3 h-3 mr-2" /> Retry Scan
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Camera Feed */}
        <div className="order-1 md:order-2 flex justify-center">
          <TechCard className="p-1 w-full max-w-md aspect-[3/4] md:aspect-square relative flex items-center justify-center bg-black/50 border-white/10">
            <div className="relative w-full h-full rounded-xl overflow-hidden bg-black">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                className="w-full h-full object-cover mirror-x" 
                style={{ transform: "scaleX(-1)" }} // CSS mirror
              />
              <ScannerOverlay status={status} message={message} />
            </div>
            
            {/* Manual Trigger (if auto fails or user prefers) */}
            {status === 'idle' && (
               <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
                 <button 
                   onClick={captureAndVerify}
                   className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full p-4 shadow-lg shadow-primary/25 transition-all hover:scale-105 active:scale-95"
                 >
                   <ScanFace className="w-6 h-6" />
                 </button>
               </div>
            )}
          </TechCard>
        </div>
      </div>
    </div>
  );
}

// Importing ScanFace for the button above
import { ScanFace } from "lucide-react";
