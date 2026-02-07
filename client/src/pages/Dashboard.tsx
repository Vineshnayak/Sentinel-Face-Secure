import { useRoute, useLocation, Switch, Route } from "wouter";
import { useLogs } from "@/hooks/use-logs";
import { format } from "date-fns";
import { LogOut, Shield, LayoutDashboard, Users, User, AlertCircle, CheckCircle, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TechCard } from "@/components/TechCard";
import { cn } from "@/lib/utils";

// --- Sub-components for different roles ---

function AdminView() {
  const { data: logs, isLoading } = useLogs();

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TechCard className="bg-primary/5 border-primary/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-lg text-primary"><Users className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Total Access Events</p>
              <h2 className="text-3xl font-display font-bold">{logs?.length || 0}</h2>
            </div>
          </div>
        </TechCard>
        
        <TechCard className="bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-lg text-emerald-400"><CheckCircle className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Successful Verifications</p>
              <h2 className="text-3xl font-display font-bold text-emerald-400">
                {logs?.filter(l => l.status === 'success').length || 0}
              </h2>
            </div>
          </div>
        </TechCard>

        <TechCard className="bg-destructive/5 border-destructive/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-destructive/20 rounded-lg text-destructive"><AlertCircle className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Security Alerts (Spoofs)</p>
              <h2 className="text-3xl font-display font-bold text-destructive">
                {logs?.filter(l => l.status === 'spoof' || l.status === 'failed').length || 0}
              </h2>
            </div>
          </div>
        </TechCard>
      </div>

      <TechCard title="Live Audit Logs" subtitle="Real-time access monitoring stream">
        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground animate-pulse">Connecting to secure log stream...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-4 px-4 font-medium">Timestamp</th>
                  <th className="py-4 px-4 font-medium">Event ID</th>
                  <th className="py-4 px-4 font-medium">User ID</th>
                  <th className="py-4 px-4 font-medium">Status</th>
                  <th className="py-4 px-4 font-medium text-right">Confidence/Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs?.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors font-mono text-sm">
                    <td className="py-3 px-4 text-muted-foreground">
                      {log.timestamp ? format(new Date(log.timestamp), "MMM dd, HH:mm:ss") : "-"}
                    </td>
                    <td className="py-3 px-4 text-xs opacity-50">#{log.id}</td>
                    <td className="py-3 px-4">{log.userId ? `User-${log.userId}` : <span className="text-muted-foreground italic">Unknown</span>}</td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "inline-flex items-center px-2 py-1 rounded-full text-xs font-bold",
                        log.status === 'success' && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                        log.status === 'failed' && "bg-destructive/10 text-destructive border border-destructive/20",
                        log.status === 'spoof' && "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                      )}>
                        {log.status === 'success' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {log.status === 'spoof' && <AlertCircle className="w-3 h-3 mr-1" />}
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono opacity-70">
                      {log.spoofScore ? `${(1 - parseFloat(log.spoofScore)).toFixed(4)}` : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TechCard>
    </div>
  );
}

function EmployeeView({ role }: { role: string }) {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <TechCard className="text-center py-12">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20">
          <Fingerprint className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-3xl font-display font-bold mb-2">Welcome Back</h2>
        <p className="text-muted-foreground mb-8">You are logged in with <span className="text-foreground font-semibold capitalize">{role}</span> privileges.</p>
        
        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
          <div className="p-4 rounded-lg bg-white/5 border border-white/5">
            <div className="text-2xl font-bold font-mono">08:42</div>
            <div className="text-xs text-muted-foreground uppercase">Clock In</div>
          </div>
           <div className="p-4 rounded-lg bg-white/5 border border-white/5 opacity-50">
            <div className="text-2xl font-bold font-mono">--:--</div>
            <div className="text-xs text-muted-foreground uppercase">Clock Out</div>
          </div>
        </div>
      </TechCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 rounded-xl bg-card border border-white/5 hover:border-primary/20 transition-colors cursor-pointer">
          <h3 className="font-bold mb-2">My Profile</h3>
          <p className="text-sm text-muted-foreground">Update personal information and view biometric status.</p>
        </div>
        <div className="p-6 rounded-xl bg-card border border-white/5 hover:border-primary/20 transition-colors cursor-pointer">
          <h3 className="font-bold mb-2">Work Schedule</h3>
          <p className="text-sm text-muted-foreground">View upcoming shifts and request time off.</p>
        </div>
      </div>
    </div>
  );
}

// --- Main Dashboard Layout ---

export default function Dashboard() {
  const [match, params] = useRoute("/dashboard/:role");
  const [, setLocation] = useLocation();
  
  if (!match) return null;
  const role = params?.role || 'guest';

  const handleLogout = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-r border-white/5 flex flex-col">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="font-display font-bold text-lg tracking-tight">SENTINEL</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Dashboard</p>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-2">
          <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Menu</div>
          
          <Button variant={role === 'admin' ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => setLocation('/dashboard/admin')}>
            <LayoutDashboard className="w-4 h-4 mr-3" /> Overview
          </Button>
          
          <Button variant={role === 'employee' || role === 'manager' ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => setLocation('/dashboard/employee')}>
            <User className="w-4 h-4 mr-3" /> My Profile
          </Button>

          {role === 'admin' && (
             <Button variant="ghost" className="w-full justify-start">
               <Shield className="w-4 h-4 mr-3" /> Security Rules
             </Button>
          )}
        </div>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs border border-primary/30">
               {role[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
               <p className="text-sm font-medium truncate capitalize">{role} User</p>
               <p className="text-xs text-muted-foreground flex items-center gap-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Online
               </p>
            </div>
          </div>
          <Button variant="outline" className="w-full border-destructive/20 hover:bg-destructive/10 text-destructive hover:text-destructive" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-1 capitalize">{role} Dashboard</h1>
            <p className="text-muted-foreground">Overview of system status and personal metrics.</p>
          </div>
          <div className="text-right hidden md:block">
            <div className="text-sm font-mono text-muted-foreground">{format(new Date(), "EEEE, MMMM dd")}</div>
          </div>
        </header>

        {role === 'admin' ? <AdminView /> : <EmployeeView role={role} />}
      </main>
    </div>
  );
}
