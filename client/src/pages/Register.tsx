import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Camera, Check, RefreshCw, UserPlus } from "lucide-react";

import { useEnroll } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TechCard } from "@/components/TechCard";
import { Progress } from "@/components/ui/progress";

// Constants
const REQUIRED_IMAGES = 5;

// Validation Schema
const enrollSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(["admin", "manager", "employee", "guest"]),
});

type EnrollFormData = z.infer<typeof enrollSchema>;

export default function Register() {
  const [step, setStep] = useState<1 | 2>(1);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const webcamRef = useRef<Webcam>(null);
  
  const enrollMutation = useEnroll();
  const form = useForm<EnrollFormData>({
    resolver: zodResolver(enrollSchema),
    defaultValues: {
      name: "",
      role: "employee",
    },
  });

  const handleCapture = useCallback(() => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setCapturedImages(prev => [...prev, imageSrc]);
    }
  }, []);

  const handleRetake = () => {
    setCapturedImages([]);
  };

  const onSubmit = (data: EnrollFormData) => {
    if (step === 1) {
      setStep(2);
    } else {
      if (capturedImages.length < REQUIRED_IMAGES) return;
      enrollMutation.mutate({
        ...data,
        images: capturedImages
      });
    }
  };

  const progress = (capturedImages.length / REQUIRED_IMAGES) * 100;
  const isComplete = capturedImages.length >= REQUIRED_IMAGES;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8">
        
        {/* Left Col: Form & Instructions */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Return Home
            </Link>
            <div className="text-sm font-mono text-primary/50">ENROLLMENT_PROTOCOL_V2</div>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl font-display font-bold">New User Enrollment</h1>
            <p className="text-muted-foreground">Register new personnel into the Sentinel database. Requires {REQUIRED_IMAGES} facial scans for high-precision model training.</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-8">
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. Sarah Connor" 
                    {...form.register("name")} 
                    className="bg-card border-white/10 focus:border-primary h-12"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Access Level</Label>
                  <Select 
                    onValueChange={(val) => form.setValue("role", val as any)}
                    defaultValue={form.getValues("role")}
                  >
                    <SelectTrigger className="bg-card border-white/10 h-12">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrator (Level 5)</SelectItem>
                      <SelectItem value="manager">Manager (Level 4)</SelectItem>
                      <SelectItem value="employee">Employee (Level 3)</SelectItem>
                      <SelectItem value="guest">Guest (Level 1)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full h-12 text-lg bg-primary text-primary-foreground hover:bg-primary/90 mt-4">
                  Continue to Biometrics <ArrowLeft className="w-4 h-4 rotate-180 ml-2" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="bg-card/50 p-4 rounded-lg border border-white/5 space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Biometric Samples</span>
                    <span className="font-mono text-primary">{capturedImages.length} / {REQUIRED_IMAGES}</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Please slightly rotate your head between captures to create a comprehensive 3D profile.
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  
                  {isComplete ? (
                    <Button 
                      type="submit" 
                      className="flex-[2] bg-primary text-primary-foreground"
                      disabled={enrollMutation.isPending}
                    >
                      {enrollMutation.isPending ? "Registering..." : "Complete Enrollment"}
                    </Button>
                  ) : (
                    <Button 
                      type="button" 
                      className="flex-[2]"
                      onClick={handleCapture}
                    >
                      <Camera className="w-4 h-4 mr-2" /> Capture Frame
                    </Button>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Right Col: Camera Interface */}
        <div className="flex items-center justify-center">
          {step === 2 ? (
            <TechCard className="w-full max-w-md p-1 bg-black/50 border-white/10">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black mb-4">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="w-full h-full object-cover mirror-x"
                  style={{ transform: "scaleX(-1)" }}
                />
                
                {/* Visual Feedback on Capture */}
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono border border-white/10">
                  {isComplete ? (
                    <span className="text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> COMPLETE</span>
                  ) : (
                    <span className="text-primary animate-pulse">RECORDING...</span>
                  )}
                </div>
              </div>

              {/* Thumbnail Grid */}
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: REQUIRED_IMAGES }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-md bg-white/5 overflow-hidden border border-white/5 relative">
                    {capturedImages[i] ? (
                      <img src={capturedImages[i]} alt={`Capture ${i}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/10">
                        <UserPlus className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {capturedImages.length > 0 && !isComplete && (
                 <Button variant="ghost" size="sm" onClick={handleRetake} className="w-full mt-4 text-xs text-muted-foreground hover:text-destructive">
                   <RefreshCw className="w-3 h-3 mr-2" /> Clear & Retake
                 </Button>
              )}
            </TechCard>
          ) : (
            // Placeholder when in step 1
            <div className="hidden lg:flex flex-col items-center justify-center text-center p-12 opacity-50">
              <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                 <Camera className="w-10 h-10 text-white/20" />
              </div>
              <h3 className="text-xl font-display font-bold">Camera Standby</h3>
              <p className="text-muted-foreground max-w-xs mt-2">Webcam will activate in the next step to capture user biometrics.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
