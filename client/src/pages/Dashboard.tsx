import { useLocation } from "wouter";
import { useLogs } from "@/hooks/use-logs";
import { useUsers } from "@/hooks/use-users";
import { format } from "date-fns";
import { LogOut, Shield, LayoutDashboard, Users, User, AlertCircle, CheckCircle, Fingerprint, BarChart3, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TechCard } from "@/components/TechCard";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface LogEntry {
  id: string;
  userId?: string;
  timestamp: Date;
  status: string;
  spoofScore?: string;
}

interface UserEntry {
  id: string;
  name: string;
  role: string;
  createdAt: string;
}

function AdminView() {
  const { data: logs, isLoading: logsLoading } = useLogs();
  const { data: users, isLoading: usersLoading } = useUsers();

  const successLogs = (logs as LogEntry[] | undefined)?.filter((l: LogEntry) => l.status === 'success') || [];
  const failedLogs = (logs as LogEntry[] | undefined)?.filter((l: LogEntry) => l.status === 'failed' || l.status === 'no_face') || [];
  const allLogs = (logs as LogEntry[] | undefined) || [];
  const allUsers = (users as UserEntry[] | undefined) || [];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <TechCard className="bg-primary/5 border-primary/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-lg text-primary"><Users className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Registered Users</p>
              <h2 className="text-3xl font-display font-bold">{allUsers.length}</h2>
            </div>
          </div>
        </TechCard>
        
        <TechCard className="bg-primary/5 border-primary/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-lg text-primary"><Users className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Total Access Events</p>
              <h2 className="text-3xl font-display font-bold">{allLogs.length}</h2>
            </div>
          </div>
        </TechCard>
        
        <TechCard className="bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-lg text-emerald-400"><CheckCircle className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Successful Verifications</p>
              <h2 className="text-3xl font-display font-bold text-emerald-400">{successLogs.length}</h2>
            </div>
          </div>
        </TechCard>

        <TechCard className="bg-destructive/5 border-destructive/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-destructive/20 rounded-lg text-destructive"><AlertCircle className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Failed Attempts</p>
              <h2 className="text-3xl font-display font-bold text-destructive">{failedLogs.length}</h2>
            </div>
          </div>
        </TechCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TechCard title="Registered Users" subtitle="All enrolled users">
          {usersLoading ? (
            <div className="py-20 text-center text-muted-foreground animate-pulse">Loading users...</div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {allUsers.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">No users registered yet</div>
              ) : (
                allUsers.map((user: UserEntry) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {user.createdAt ? format(new Date(user.createdAt), "MMM dd, yyyy") : '-'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </TechCard>

        <TechCard title="Live Audit Logs" subtitle="Real-time access monitoring stream">
          {logsLoading ? (
            <div className="py-20 text-center text-muted-foreground animate-pulse">Connecting to secure log stream...</div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-4 px-4 font-medium">Time</th>
                    <th className="py-4 px-4 font-medium">Status</th>
                    <th className="py-4 px-4 font-medium text-right">Conf.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {allLogs.slice(0, 50).map((log: LogEntry) => (
                    <tr key={log.id || Math.random()} className="hover:bg-white/5 transition-colors font-mono text-sm">
                      <td className="py-3 px-4 text-muted-foreground">
                        {log.timestamp ? format(log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp), "MMM dd, HH:mm:ss") : "-"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "inline-flex items-center px-2 py-1 rounded-full text-xs font-bold",
                          log.status === 'success' && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                          log.status === 'failed' && "bg-destructive/10 text-destructive border border-destructive/20",
                          log.status === 'no_face' && "bg-orange-500/10 text-orange-400 border border-orange-500/20",
                          log.status === 'liveness_failed' && "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                        )}>
                          {log.status === 'success' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {(log.status === 'failed' || log.status === 'no_face' || log.status === 'liveness_failed') && <AlertCircle className="w-3 h-3 mr-1" />}
                          {log.status.toUpperCase().replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono opacity-70">
                        {log.spoofScore ? `${(parseFloat(log.spoofScore) * 100).toFixed(1)}%` : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TechCard>
      </div>
    </div>
  );
}

function ManagerView() {
  const { data, isLoading } = useLogs();
  const { data: users } = useUsers();
  const logs = data as LogEntry[] | undefined;
  const successLogs = logs?.filter((l: LogEntry) => l.status === 'success') || [];
  const allUsers = (users as UserEntry[] | undefined) || [];
  const totalEmployees = allUsers.length || 5;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TechCard className="bg-primary/5 border-primary/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-lg text-primary"><Users className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Team Members</p>
              <h2 className="text-3xl font-display font-bold">{totalEmployees}</h2>
            </div>
          </div>
        </TechCard>
        
        <TechCard className="bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-lg text-emerald-400"><CheckCircle className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Today's Check-ins</p>
              <h2 className="text-3xl font-display font-bold text-emerald-400">{successLogs.length}</h2>
            </div>
          </div>
        </TechCard>

        <TechCard className="bg-blue-500/5 border-blue-500/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400"><Clock className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Present Today</p>
              <h2 className="text-3xl font-display font-bold text-blue-400">{Math.min(successLogs.length, totalEmployees)}</h2>
            </div>
          </div>
        </TechCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TechCard title="Team Overview" subtitle="Employee attendance summary">
          <div className="space-y-4">
            {allUsers.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">No team members registered</div>
            ) : (
              allUsers.slice(0, 10).map((user: UserEntry) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                    </div>
                  </div>
                  <span className="text-emerald-400 text-sm">Present</span>
                </div>
              ))
            )}
          </div>
        </TechCard>

        <TechCard title="Recent Activity" subtitle="Team access logs">
          <div className="space-y-3">
            {successLogs.slice(0, 5).map((log: any, idx: any) => (
              <div key={log.id || idx} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">User {log.userId?.substring(0, 6) || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.timestamp ? format(log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp), "HH:mm:ss") : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </TechCard>
      </div>
    </div>
  );
}

function EmployeeView() {
  const { data: users } = useUsers();
  const allUsers = (users as UserEntry[] | undefined) || [];
  
  // Get authenticated user from localStorage - make it reactive
  const [authenticatedUser, setAuthenticatedUser] = useState(() => {
    try {
      let stored = localStorage.getItem('authenticatedUser');
      if (!stored) {
        stored = localStorage.getItem('auth_user');
      }
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse authenticated user', e);
    }
    return null;
  });
  
    // Update when component mounts or localStorage changes
  useEffect(() => {
    const updateUser = () => {
      try {
        let stored = localStorage.getItem('authenticatedUser');
        if (!stored) {
          stored = localStorage.getItem('auth_user');
        }
        if (stored) {
          const user = JSON.parse(stored);
          setAuthenticatedUser(prev => {
            if (!prev || prev.id !== user.id || prev.name !== user.name || prev.timestamp !== user.timestamp) {
              console.log('[EmployeeView] Updated authenticated user:', user.name, 'ID:', user.id);
              return user;
            }
            return prev;
          });
        }
      } catch (e) {
        console.error('Failed to parse authenticated user', e);
      }
    };
    
    updateUser();
    const interval = setInterval(updateUser, 200);
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'authenticatedUser' || e.key === 'auth_user') {
        updateUser();
      }
    };
    
    const handleAuthChange = (e: CustomEvent) => {
      console.log('[EmployeeView] Auth change event detected');
      updateUser();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', updateUser);
    window.addEventListener('authUserChanged', handleAuthChange as EventListener);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', updateUser);
      window.removeEventListener('authUserChanged', handleAuthChange as EventListener);
    };
  }, []);
  
  const employeeName = authenticatedUser?.name || 
    allUsers.find((u: UserEntry) => u.role === 'employee')?.name || 
    'Employee';

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <TechCard className="text-center py-12">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20">
          <Fingerprint className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-3xl font-display font-bold mb-2">Welcome Back</h2>
        <p className="text-muted-foreground mb-8">{employeeName}</p>
        
        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
          <div className="p-4 rounded-lg bg-white/5 border border-white/5">
            <div className="text-2xl font-bold font-mono">09:00</div>
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
          <div className="flex items-center gap-3 mb-2">
            <User className="w-5 h-5 text-primary" />
            <h3 className="font-bold">My Profile</h3>
          </div>
          <p className="text-sm text-muted-foreground">Update personal information and view biometric status.</p>
        </div>
        <div className="p-6 rounded-xl bg-card border border-white/5 hover:border-primary/20 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-bold">Work Schedule</h3>
          </div>
          <p className="text-sm text-muted-foreground">View upcoming shifts and request time off.</p>
        </div>
        <div className="p-6 rounded-xl bg-card border border-white/5 hover:border-primary/20 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="font-bold">My Attendance</h3>
          </div>
          <p className="text-sm text-muted-foreground">View your attendance history and statistics.</p>
        </div>
        <div className="p-6 rounded-xl bg-card border border-white/5 hover:border-primary/20 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-bold">My Documents</h3>
          </div>
          <p className="text-sm text-muted-foreground">Access your personal documents and files.</p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [location, setLocation] = useLocation();
  
  const roleMatch = location.match(/\/dashboard\/(\w+)/);
  const role = roleMatch ? roleMatch[1] : 'guest';
  
  // Get authenticated user info - make it reactive to localStorage changes
  const [authenticatedUser, setAuthenticatedUser] = useState(() => {
    try {
      let stored = localStorage.getItem('authenticatedUser');
      if (!stored) {
        stored = localStorage.getItem('auth_user');
      }
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse authenticated user', e);
    }
    return null;
  });
  
  // Update authenticated user when location changes (new login)
  useEffect(() => {
    const updateUser = () => {
      try {
        let stored = localStorage.getItem('authenticatedUser');
        if (!stored) {
          stored = localStorage.getItem('auth_user');
        }
        if (stored) {
          const user = JSON.parse(stored);
          // Always update to ensure latest user is shown
          setAuthenticatedUser(prev => {
            if (!prev || prev.id !== user.id || prev.name !== user.name || prev.timestamp !== user.timestamp) {
              console.log('[Dashboard] Updated authenticated user:', user.name, 'ID:', user.id, 'Timestamp:', user.timestamp);
              return user;
            }
            return prev;
          });
        } else {
          setAuthenticatedUser(null);
        }
      } catch (e) {
        console.error('Failed to parse authenticated user', e);
        setAuthenticatedUser(null);
      }
    };
    
    // Update immediately
    updateUser();
    
    // Listen for storage events (cross-tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'authenticatedUser' || e.key === 'auth_user') {
        console.log('[Dashboard] Storage event detected, updating user');
        updateUser();
      }
    };
    
    // Listen for custom auth change event (same-tab)
    const handleAuthChange = (e: CustomEvent) => {
      console.log('[Dashboard] Auth change event detected, updating user:', e.detail?.name);
      updateUser();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', updateUser);
    window.addEventListener('authUserChanged', handleAuthChange as EventListener);
    
    // Also check periodically (for same-tab updates) - more frequent
    const interval = setInterval(() => {
      updateUser();
    }, 200); // Reduced to 200ms for faster updates
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', updateUser);
      window.removeEventListener('authUserChanged', handleAuthChange as EventListener);
      clearInterval(interval);
    };
  }, [location]); // Re-run when location changes, [location]); // Re-run when location changes
  
  const displayName = authenticatedUser?.name || role.charAt(0).toUpperCase() + role.slice(1);

  const handleLogout = () => {
    localStorage.removeItem('authenticatedUser');
    localStorage.removeItem('auth_user'); // Also remove fallback key
    setAuthenticatedUser(null);
    setLocation("/");
  };

  const renderView = () => {
    switch (role) {
      case 'admin':
        return <AdminView />;
      case 'manager':
        return <ManagerView />;
      case 'employee':
      case 'guest':
      default:
        return <EmployeeView />;
    }
  };

  const renderMenu = () => {
    return (
      <div className="flex-1 p-4 space-y-2">
        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Menu</div>
        
        {role === 'admin' && (
          <Button variant="secondary" className="w-full justify-start">
            <LayoutDashboard className="w-4 h-4 mr-3" /> Overview
          </Button>
        )}
        
        {role === 'manager' && (
          <Button variant="secondary" className="w-full justify-start">
            <Users className="w-4 h-4 mr-3" /> Team Overview
          </Button>
        )}
        
        <Button 
          variant={role === 'employee' || role === 'guest' ? "secondary" : "ghost"} 
          className="w-full justify-start"
        >
          <User className="w-4 h-4 mr-3" /> My Profile
        </Button>

        {role === 'admin' && (
          <Button variant="ghost" className="w-full justify-start">
            <Shield className="w-4 h-4 mr-3" /> Security Settings
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-card border-r border-white/5 flex flex-col">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="font-display font-bold text-lg tracking-tight">SENTINEL</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Dashboard</p>
          </div>
        </div>

        {renderMenu()}

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs border border-primary/30">
               {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
               <p className="text-sm font-medium truncate">{displayName}</p>
               <p className="text-xs text-muted-foreground flex items-center gap-1 capitalize">
                 <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> {role} • Online
               </p>
            </div>
          </div>
          <Button variant="outline" className="w-full border-destructive/20 hover:bg-destructive/10 text-destructive hover:text-destructive" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-1 capitalize">{role} Dashboard</h1>
            <p className="text-muted-foreground">
              {role === 'admin' && 'System overview and security monitoring'}
              {role === 'manager' && 'Team management and attendance tracking'}
              {role === 'employee' && 'Your personal dashboard and attendance'}
              {role === 'guest' && 'Limited access dashboard'}
            </p>
          </div>
          <div className="text-right hidden md:block">
            <div className="text-sm font-mono text-muted-foreground">{format(new Date(), "EEEE, MMMM dd, yyyy")}</div>
            <div className="text-lg font-mono">{format(new Date(), "HH:mm:ss")}</div>
          </div>
        </header>

        {renderView()}
      </main>
    </div>
  );
}
