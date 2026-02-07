import { Link } from "wouter";
import { ShieldCheck, UserPlus, ScanFace, Lock } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative selection:bg-primary/20">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-accent/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Navbar */}
      <nav className="relative z-50 max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-primary/20 p-2 rounded-lg border border-primary/20">
            <ScanFace className="w-6 h-6 text-primary" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">SENTINEL<span className="text-primary">FACE</span></span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            System Access
          </Link>
          <Link href="/register" className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-all">
            Enroll New User
          </Link>
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
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 w-full max-w-5xl text-left"
        >
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm hover:border-primary/30 transition-colors">
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4 text-blue-400">
              <ScanFace className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold font-display mb-2">Liveness Detection</h3>
            <p className="text-muted-foreground text-sm">Prevents spoofing attacks using photos or videos by analyzing depth and micro-movements.</p>
          </div>
          
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm hover:border-primary/30 transition-colors">
            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4 text-purple-400">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold font-display mb-2">Role-Based Access</h3>
            <p className="text-muted-foreground text-sm">Granular control with distinct dashboards for Admins, Managers, Employees, and Guests.</p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm hover:border-primary/30 transition-colors">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold font-display mb-2">Audit Logging</h3>
            <p className="text-muted-foreground text-sm">Comprehensive tracking of every authentication attempt, success, failure, and spoof detection.</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
