import { Link } from "wouter";
import { ShieldCheck, UserPlus, ScanFace, Lock, Sparkles, Zap, Eye } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative selection:bg-primary/20">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-accent/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Navbar */}
      <nav className="relative z-50 max-w-7xl mx-auto px-6 py-6 flex items-center">
        <div className="flex items-center gap-2">
          <div className="bg-primary/20 p-2 rounded-lg border border-primary/20">
            <ScanFace className="w-6 h-6 text-primary" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">SENTINEL<span className="text-primary">FACE</span></span>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono mb-8"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          SYSTEM ONLINE // SECURE MODE
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-5xl md:text-7xl font-display font-bold tracking-tight mb-6 max-w-4xl"
        >
          Next-Generation <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-accent text-glow">
            Biometric Security
          </span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-12 leading-relaxed"
        >
          Advanced facial authentication with active liveness detection and anti-spoofing technology. 
          Secure your premises with military-grade precision.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
        >
          <Link 
            href="/login" 
            className="group relative px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-xl overflow-hidden shadow-[0_0_20px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_40px_hsl(var(--primary)/0.5)] transition-all"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative flex items-center justify-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Authenticate
            </span>
          </Link>
          
          <Link 
            href="/register" 
            className="group px-8 py-4 bg-card hover:bg-muted border border-border text-foreground font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <UserPlus className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            Enroll User
          </Link>
        </motion.div>

        {/* Features Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-32 w-full max-w-5xl text-left"
        >
          {/* Feature 1 */}
          <div className="p-5 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm hover:border-primary/30 transition-colors group">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3 text-blue-400 group-hover:scale-110 transition-transform">
              <ScanFace className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold font-display mb-1">Active Liveness</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Blocks spoofing via photos or video playbacks with advanced depth analysis.</p>
          </div>
          
          {/* Feature 2 */}
          <div className="p-5 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm hover:border-primary/30 transition-colors group">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3 text-purple-400 group-hover:scale-110 transition-transform">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold font-display mb-1">Role-Based Auth</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Granular access control tailored for Admins, Managers, and Employees.</p>
          </div>

          {/* Feature 3 */}
          <div className="p-5 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm hover:border-primary/30 transition-colors group">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3 text-emerald-400 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold font-display mb-1">Immutable Logs</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Comprehensive tracking of all authentication attempts and spoof detections.</p>
          </div>

          {/* Feature 4 */}
          <div className="p-5 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm hover:border-primary/30 transition-colors group">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3 text-amber-400 group-hover:scale-110 transition-transform">
              <Eye className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold font-display mb-1">Adaptive Vision</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Seamlessly recognizes users even when wearing glasses or partial face masks.</p>
          </div>

          {/* Feature 5 */}
          <div className="p-5 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm hover:border-primary/30 transition-colors group">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center mb-3 text-rose-400 group-hover:scale-110 transition-transform">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold font-display mb-1">Sub-second Speed</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Optimized MobileNetV2 architecture delivers instant verification at the edge.</p>
          </div>

          {/* Feature 6 */}
          <div className="p-5 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm hover:border-primary/30 transition-colors group">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-3 text-cyan-400 group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold font-display mb-1">AI Analytics</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Generates intelligent insights, anomaly reports, and daily security briefings.</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
