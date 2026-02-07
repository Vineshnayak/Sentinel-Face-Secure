import { motion } from "framer-motion";

interface ScannerOverlayProps {
  status: "idle" | "scanning" | "success" | "error";
  message?: string;
}

export function ScannerOverlay({ status, message }: ScannerOverlayProps) {
  const getColor = () => {
    switch (status) {
      case "success": return "hsl(var(--primary))"; // Blue/Green
      case "error": return "hsl(var(--destructive))"; // Red
      case "scanning": return "hsl(var(--accent))"; // Cyan
      default: return "hsl(var(--muted-foreground))";
    }
  };

  const color = getColor();

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8 z-20">
      {/* Corner Brackets */}
      <div className="absolute inset-4 border-[3px] border-transparent transition-colors duration-300" style={{ borderColor: status === 'idle' ? 'rgba(255,255,255,0.1)' : 'transparent' }}>
        {/* Top Left */}
        <div className="absolute top-0 left-0 w-16 h-16 border-t-[4px] border-l-[4px] rounded-tl-xl transition-all duration-300" style={{ borderColor: color }} />
        {/* Top Right */}
        <div className="absolute top-0 right-0 w-16 h-16 border-t-[4px] border-r-[4px] rounded-tr-xl transition-all duration-300" style={{ borderColor: color }} />
        {/* Bottom Left */}
        <div className="absolute bottom-0 left-0 w-16 h-16 border-b-[4px] border-l-[4px] rounded-bl-xl transition-all duration-300" style={{ borderColor: color }} />
        {/* Bottom Right */}
        <div className="absolute bottom-0 right-0 w-16 h-16 border-b-[4px] border-r-[4px] rounded-br-xl transition-all duration-300" style={{ borderColor: color }} />
      </div>

      {/* Scanning Beam */}
      {status === "scanning" && (
        <div className="absolute inset-4 overflow-hidden rounded-xl">
           <motion.div
            initial={{ top: "-10%", opacity: 0 }}
            animate={{ top: "110%", opacity: [0, 1, 1, 0] }}
            transition={{ 
              repeat: Infinity, 
              duration: 2, 
              ease: "linear" 
            }}
            className="absolute w-full h-1 bg-accent/50 shadow-[0_0_20px_rgba(var(--accent),0.8)] blur-[2px]"
          />
        </div>
      )}

      {/* Status Message */}
      <div className="mt-auto mb-8 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
        <p className="font-mono text-sm uppercase tracking-wider font-bold" style={{ color }}>
          {status === 'idle' ? 'Ready for scan' : 
           status === 'scanning' ? 'Analyzing Biometrics...' : 
           message || status}
        </p>
      </div>

      {/* Success/Error Icon Overlay */}
      {status === "success" && (
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-primary/10 backdrop-blur-[2px]"
        >
          <div className="w-24 h-24 rounded-full border-4 border-primary flex items-center justify-center shadow-[0_0_30px_hsl(var(--primary))]">
            <svg className="w-12 h-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </motion.div>
      )}

      {status === "error" && (
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-destructive/10 backdrop-blur-[2px]"
        >
          <div className="w-24 h-24 rounded-full border-4 border-destructive flex items-center justify-center shadow-[0_0_30px_hsl(var(--destructive))]">
            <svg className="w-12 h-12 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </motion.div>
      )}
    </div>
  );
}
