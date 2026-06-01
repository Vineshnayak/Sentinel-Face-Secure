import { useCallback, useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { Link, useLocation } from "wouter";
import { ArrowLeft, RefreshCw, AlertTriangle, ScanFace, Eye, Activity, Clock, CheckCircle2 } from "lucide-react";
import { useVerify } from "@/hooks/use-auth";
import { ScannerOverlay } from "@/components/ScannerOverlay";
import { TechCard } from "@/components/TechCard";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface VerificationMetrics {
  blinkCount?: number;
  livenessScore?: number;
  headMovementDetected?: boolean;
  similarity?: number;
  detectionTime?: number;
  embeddingTime?: number;
  totalLatency?: number;
}

export default function Login() {
  const webcamRef = useRef<Webcam>(null);
  const verifyMutation = useVerify();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [metrics, setMetrics] = useState<VerificationMetrics | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [locationStr, setLocationStr] = useState<string | undefined>(undefined);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationStr(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
        },
        (error) => {
          console.log("[Login] Location access denied or error:", error);
        }
      );
    }
  }, []);

  const captureAndVerify = useCallback(async () => {
    if (!webcamRef.current) return;
    
    setStatus("scanning");
    
    const frames: string[] = [];
    const frameCount = 12;
    const delayMs = 120;
    for (let i = 0; i < frameCount; i++) {
      const frame = webcamRef.current.getScreenshot();
      if (frame) {
        frames.push(frame);
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    if (frames.length === 0) {
      setStatus("error");
      setMessage("Camera error");
      return;
    }

    try {
      const result = await verifyMutation.mutateAsync({ 
        image: frames[0],
        images: frames,
        sessionId,
        location: locationStr
      });
      
      if (result.verified && result.user) {
        setStatus("success");
        setMessage(`Welcome, ${result.user.name}`);
        
        setMetrics({
          blinkCount: result.blinkCount ?? result.blink_count,
          livenessScore: result.livenessScore ?? result.liveness_score,
          headMovementDetected: result.headMovementDetected ?? result.head_movement_detected,
          similarity: result.similarity,
          detectionTime: result.detectionTime ?? result.detection_time,
          embeddingTime: result.embeddingTime ?? result.embedding_time,
          totalLatency: result.totalLatency ?? result.total_latency
        });
        
        const userData = {
          id: result.user.id,
          name: result.user.name,
          role: result.user.role,
          timestamp: Date.now()
        };
        localStorage.removeItem('authenticatedUser');
        localStorage.removeItem('auth_user');
        
        localStorage.setItem('authenticatedUser', JSON.stringify(userData));
        console.log('[Login] Stored authenticated user:', userData.name, 'ID:', userData.id, 'Timestamp:', userData.timestamp);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        window.dispatchEvent(new CustomEvent('authUserChanged', { 
          detail: userData 
        }));
        
        window.dispatchEvent(new Event('focus'));
        
        setTimeout(() => {
          const role = result.user?.role || 'guest';
          setLocation(`/dashboard/${role}`);
        }, 1500);
      } else {
        setStatus("error");
        setMessage(result.message || "Authentication failed");
        setMetrics(null);
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Verification error");
    }
  }, [verifyMutation, setLocation]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === 'idle') {
        captureAndVerify();
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [status, captureAndVerify]);

  const handleManualRetry = () => {
    setRetryCount(c => c + 1);
    setStatus("idle");
    setMessage("");
    setMetrics(null);
    setTimeout(captureAndVerify, 500);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
        <div className="order-2 md:order-1 space-y-6">
          <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          
          <div>
            <h1 className="text-4xl font-display font-bold mb-2">System Access</h1>
            <p className="text-muted-foreground">
              Look at the camera. When the scan starts, blink once or twice so we can verify you are live. 
              Keep your face well-lit and in frame.
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
                  Blink during the scan to pass liveness. We analyze eye movement and head motion to prevent spoofing.
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

            {status === 'success' && metrics && (
              <div className="space-y-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-sm font-semibold text-emerald-400">Verification Metrics</h4>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2 bg-white/5 rounded">
                    <Eye className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Blinks</p>
                      <p className="text-sm font-mono font-bold">{metrics.blinkCount ?? 0}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 p-2 bg-white/5 rounded">
                    <Activity className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Liveness</p>
                      <p className="text-sm font-mono font-bold">
                        {metrics.livenessScore != null && !Number.isNaN(metrics.livenessScore)
                          ? (metrics.livenessScore * 100).toFixed(0) + '%'
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 p-2 bg-white/5 rounded">
                    <Activity className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Head Movement</p>
                      <p className="text-sm font-mono font-bold">
                        {metrics.headMovementDetected === true ? 'Yes' : metrics.headMovementDetected === false ? 'No' : 'N/A'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 p-2 bg-white/5 rounded">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Similarity</p>
                      <p className="text-sm font-mono font-bold">
                        {metrics.similarity != null && !Number.isNaN(metrics.similarity)
                          ? (metrics.similarity * 100).toFixed(1) + '%'
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <Clock className="w-3 h-3" />
                    <span>Detection: {metrics.detectionTime != null && !Number.isNaN(metrics.detectionTime) ? metrics.detectionTime.toFixed(0) + 'ms' : 'N/A'}</span>
                    <span>•</span>
                    <span>Embedding: {metrics.embeddingTime != null && !Number.isNaN(metrics.embeddingTime) ? metrics.embeddingTime.toFixed(0) + 'ms' : 'N/A'}</span>
                    <span>•</span>
                    <span>Total: {metrics.totalLatency != null && !Number.isNaN(metrics.totalLatency) ? metrics.totalLatency.toFixed(0) + 'ms' : 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            {status === 'scanning' && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <p className="text-xs text-blue-400 font-mono">Analyzing biometrics...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="order-1 md:order-2 flex justify-center">
          <TechCard className="p-1 w-full max-w-md aspect-[3/4] md:aspect-square relative flex items-center justify-center bg-black/50 border-white/10">
            <div className="relative w-full h-full rounded-xl overflow-hidden bg-black">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                className="w-full h-full object-cover mirror-x" 
                style={{ transform: "scaleX(-1)" }}
              />
              <ScannerOverlay status={status} message={message} />
            </div>
            
            {status === 'idle' && (
               <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
                 <button 
                   onClick={captureAndVerify}
                   aria-label="Start face scan"
                   title="Start face scan"
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
