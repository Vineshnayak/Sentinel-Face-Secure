import { useLocation } from "wouter";
import { useLogs, useAiSummary, fetchAiAnalysis } from "@/hooks/use-logs";
import { useUsers } from "@/hooks/use-users";
import { format } from "date-fns";
import { LogOut, Shield, LayoutDashboard, Users, User, AlertCircle, CheckCircle, Fingerprint, BarChart3, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiEvaluationView } from "@/components/AiEvaluationView";
import { AgentAlertsView } from "@/components/AgentAlertsView";
import { useToast } from "@/hooks/use-toast";
import { TechCard } from "@/components/TechCard";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo, useRef } from "react";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Filter, Smartphone, Monitor, ShieldAlert, Laptop, Sparkles, X, Brain, BrainCircuit, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface LogEntry {
  id: string;
  userId?: string;
  timestamp: Date;
  status: string;
  spoofScore?: string;
  device?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  location?: string;
  sessionId?: string;
  confidenceScore?: number;
  livenessScore?: number;
  riskScore?: number;
  riskLevel?: string;
}

interface UserEntry {
  id: string;
  name: string;
  role: string;
  createdAt: string;
}

function AdminView({ hasApiKey }: { hasApiKey: boolean }) {
  const { data: logs, isLoading: logsLoading } = useLogs();
  const { data: users, isLoading: usersLoading } = useUsers();
  const { toast } = useToast();
  
  const [logFilter, setLogFilter] = useState<'all' | 'success' | 'suspicious' | 'high_risk'>('all');

  const [selectedAiLog, setSelectedAiLog] = useState<LogEntry | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { data: aiSummary, refetch: fetchSummary, isFetching: isFetchingSummary } = useAiSummary();

  const handleAnalyzeLog = async (log: LogEntry) => {
    setSelectedAiLog(log);
    setAiAnalysis(null);
    setIsAnalyzing(true);
    try {
      const insight = await fetchAiAnalysis(log.id);
      setAiAnalysis(insight);
    } catch (err) {
      setAiAnalysis("Failed to load analysis. Check backend.");
    } finally {
      setIsAnalyzing(false);
    }
  };


  const allLogs = (logs as LogEntry[] | undefined) || [];
  const allUsers = (users as UserEntry[] | undefined) || [];

  const metrics = useMemo(() => {
    const success = allLogs.filter(l => l.status === 'success');
    const suspicious = allLogs.filter(l => ['failed', 'no_face', 'liveness_failed'].includes(l.status));
    const highRisk = allLogs.filter(l => l.status === 'spoof');
    
    return {
      total: allLogs.length,
      success: success.length,
      suspicious: suspicious.length,
      highRisk: highRisk.length,
    };
  }, [allLogs]);

  const trendData = useMemo(() => {
    // Group logs by hour for the last 24 hours (simplified)
    const data: Record<string, any> = {};
    const now = new Date();
    // Initialize last 12 hours
    for(let i=11; i>=0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      const label = format(d, 'HH:00');
      data[label] = { time: label, success: 0, failed: 0 };
    }
    
    allLogs.forEach(log => {
      const d = new Date(log.timestamp);
      if (now.getTime() - d.getTime() <= 12 * 60 * 60 * 1000) {
        const label = format(d, 'HH:00');
        if(data[label]) {
           if(log.status === 'success') data[label].success++;
           else data[label].failed++;
        }
      }
    });
    return Object.values(data);
  }, [allLogs]);

  const pieData = useMemo(() => {
    return [
      { name: 'Safe', value: metrics.success, color: '#34d399' },
      { name: 'Suspicious', value: metrics.suspicious, color: '#fb923c' },
      { name: 'High Risk', value: metrics.highRisk, color: '#ef4444' }
    ].filter(d => d.value > 0);
  }, [metrics]);

  const deviceStats = useMemo(() => {
    const stats: Record<string, number> = {};
    allLogs.forEach(log => {
      const dev = log.os || log.device || 'Unknown';
      stats[dev] = (stats[dev] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [allLogs]);

  const filteredLogs = useMemo(() => {
    if (logFilter === 'success') return allLogs.filter(l => l.status === 'success');
    if (logFilter === 'suspicious') return allLogs.filter(l => ['failed', 'no_face', 'liveness_failed'].includes(l.status));
    if (logFilter === 'high_risk') return allLogs.filter(l => l.status === 'spoof');
    return allLogs;
  }, [allLogs, logFilter]);

  return (
    <div className="space-y-6">
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-display font-semibold">Security Overview</h2>
            <p className="text-sm text-muted-foreground">High-level metrics and system status</p>
          </div>
          <Button 
            onClick={() => window.open(`${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/reports/daily`, '_blank')}
            className="bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
          >
            <FileText className="w-4 h-4 mr-2" />
            Export PDF Report
          </Button>
        </div>

        {/* High-Level Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <TechCard className="bg-primary/5 border-primary/20 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-md text-primary"><Shield className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Events</p>
                <h2 className="text-2xl font-mono font-bold">{metrics.total}</h2>
              </div>
            </div>
          </TechCard>
          
          <TechCard className="bg-emerald-500/5 border-emerald-500/20 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-md text-emerald-400"><CheckCircle className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Safe Logins</p>
                <h2 className="text-2xl font-mono font-bold text-emerald-400">{metrics.success}</h2>
              </div>
            </div>
          </TechCard>

          <TechCard className="bg-orange-500/5 border-orange-500/20 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-md text-orange-400"><AlertCircle className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Suspicious</p>
                <h2 className="text-2xl font-mono font-bold text-orange-400">{metrics.suspicious}</h2>
              </div>
            </div>
          </TechCard>
          
          <TechCard className="bg-destructive/5 border-destructive/20 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/20 rounded-md text-destructive"><ShieldAlert className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">High Risk</p>
                <h2 className="text-2xl font-mono font-bold text-destructive">{metrics.highRisk}</h2>
              </div>
            </div>
          </TechCard>
        </div>

        {/* Middle Row: Trend Chart & AI Briefing */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TechCard className="lg:col-span-2" title="Authentication Trends" subtitle="Login activity over the last 12 hours">
            <div className="h-64 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="time" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '14px' }}
                  />
                  <Area type="monotone" dataKey="success" stroke="#34d399" strokeWidth={2} fillOpacity={1} fill="url(#colorSuccess)" name="Successful Logins" />
                  <Area type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorFailed)" name="Failed Attempts" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TechCard>
          
          <TechCard title="AI Daily Briefing" subtitle="Intelligent SOC Summary">
            <div className="flex flex-col h-full mt-4">
              <Button 
                onClick={() => fetchSummary()} 
                disabled={isFetchingSummary || !hasApiKey}
                className={`w-full mb-4 ${hasApiKey ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
              >
                <Brain className="w-4 h-4 mr-2" />
                {isFetchingSummary ? "Analyzing Logs..." : "Generate Insights"}
              </Button>
              {!hasApiKey && (
                <p className="text-xs text-rose-400 font-mono text-center mb-4 mt-[-8px]">⚠️ Groq API Key required in Settings</p>
              )}
              
              <div className="flex-1 overflow-y-auto bg-white/5 rounded-lg border border-white/10 p-4">
                {aiSummary ? (
                  <div className="text-sm text-white/80 prose prose-invert max-w-none">
                    {aiSummary.split('\n').map((line: string, i: number) => (
                      <p key={i} className="mb-2 leading-relaxed">{line}</p>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic flex items-center justify-center h-full text-center">
                    Click generate to request a high-level briefing of recent security events.
                  </div>
                )}
              </div>
            </div>
          </TechCard>
        </div>

        {/* Live Audit Logs */}
        <TechCard title="Live Audit Logs" subtitle="Continuous security monitoring stream">
          <div className="flex gap-2 mb-4 mt-4 overflow-x-auto pb-2">
            <Button 
              variant={logFilter === 'all' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setLogFilter('all')}
              className="rounded-full h-8 px-4 text-xs"
            >
              All Events
            </Button>
            <Button 
              variant={logFilter === 'success' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setLogFilter('success')}
              className="rounded-full h-8 px-4 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
            >
              Safe Logins
            </Button>
            <Button 
              variant={logFilter === 'suspicious' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setLogFilter('suspicious')}
              className="rounded-full h-8 px-4 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300"
            >
              Suspicious
            </Button>
            <Button 
              variant={logFilter === 'high_risk' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setLogFilter('high_risk')}
              className="rounded-full h-8 px-4 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              High Risk
            </Button>
          </div>

          {logsLoading ? (
            <div className="py-20 text-center text-muted-foreground animate-pulse text-sm">Connecting to secure stream...</div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 px-3 font-medium">Time</th>
                    <th className="py-3 px-3 font-medium hidden md:table-cell">Device / IP</th>
                    <th className="py-3 px-3 font-medium hidden lg:table-cell">Location</th>
                    <th className="py-3 px-3 font-medium">Status</th>
                    <th className="py-3 px-3 font-medium text-center">Risk</th>
                    <th className="py-3 px-3 font-medium text-right">Scores (M/L)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">No events found</td>
                      </tr>
                  ) : filteredLogs.slice(0, 50).map((log: LogEntry) => (
                    <tr key={log.id || Math.random()} className="hover:bg-white/5 transition-colors font-mono text-xs">
                      <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                        {log.timestamp ? format(log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp), "MMM dd, HH:mm:ss") : "-"}
                      </td>
                      <td className="py-3 px-3 hidden md:table-cell">
                        <div className="flex flex-col">
                          <span className="text-white truncate max-w-[120px]">{log.device || log.browser || log.os || 'Unknown Device'}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">{log.ipAddress || 'Unknown IP'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 hidden lg:table-cell">
                        <span className="text-muted-foreground truncate max-w-[100px] block" title={log.location}>{log.location || '-'}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded-sm font-bold whitespace-nowrap",
                          log.status === 'success' && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                          (log.status === 'failed' || log.status === 'spoof') && "bg-destructive/10 text-destructive border border-destructive/20",
                          log.status === 'no_face' && "bg-orange-500/10 text-orange-400 border border-orange-500/20",
                          log.status === 'liveness_failed' && "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                        )}>
                          {log.status === 'success' && <CheckCircle className="w-2.5 h-2.5 mr-1" />}
                          {(log.status === 'failed' || log.status === 'no_face' || log.status === 'liveness_failed' || log.status === 'spoof') && <AlertCircle className="w-2.5 h-2.5 mr-1" />}
                          {log.status.toUpperCase().replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {log.riskLevel ? (
                          <span className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded-sm font-bold text-[10px]",
                            log.riskLevel === 'LOW' && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                            log.riskLevel === 'MEDIUM' && "bg-orange-500/10 text-orange-400 border border-orange-500/20",
                            log.riskLevel === 'HIGH' && "bg-destructive/10 text-destructive border border-destructive/20"
                          )}>
                            {log.riskScore} - {log.riskLevel}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">-</span>
                        )}
                        {(log.riskLevel === 'HIGH' || log.riskLevel === 'MEDIUM') && (
                          <button 
                            onClick={() => {
                              if (hasApiKey) handleAnalyzeLog(log);
                              else toast({title: "API Key Required", description: "Please configure your Groq API key in Security Settings first.", variant: "destructive"})
                            }}
                            className={`ml-2 transition-colors ${hasApiKey ? 'text-indigo-400 hover:text-indigo-300' : 'text-slate-600 cursor-not-allowed'}`}
                            title={hasApiKey ? "Ask AI to analyze this event" : "API Key Required"}
                          >
                            <Sparkles className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[10px]">
                        <div className="flex flex-col items-end">
                          <span className={log.confidenceScore && log.confidenceScore > 0.85 ? "text-emerald-400 font-bold" : "text-muted-foreground"}>
                            M: {log.confidenceScore != null ? (log.confidenceScore * 100).toFixed(1) + '%' : "N/A"}
                          </span>
                          <span className={log.livenessScore && log.livenessScore > 0.5 ? "text-emerald-400/80 mt-0.5" : "text-orange-400/80 mt-0.5"}>
                            L: {log.livenessScore != null ? (log.livenessScore * 100).toFixed(1) + '%' : "N/A"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TechCard>

        {/* Additional Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <TechCard title="Risk Breakdown" subtitle="Distribution of security events">
            <div className="h-48 w-full flex flex-col items-center justify-center mt-4">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-muted-foreground text-sm">No data available</div>
              )}
              <div className="flex flex-wrap gap-3 justify-center w-full mt-2">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span>
                    <span className="text-muted-foreground">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </TechCard>

          <TechCard title="Top Environments" subtitle="Devices and OS">
            <div className="space-y-3 mt-4">
              {deviceStats.length > 0 ? deviceStats.map((stat, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-white/5 text-muted-foreground">
                      {stat.name.includes('Mac') || stat.name.includes('Windows') ? <Laptop className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-sm font-medium">{stat.name}</span>
                  </div>
                  <span className="text-sm font-mono text-muted-foreground">{stat.count}</span>
                </div>
              )) : (
                 <div className="py-4 text-center text-sm text-muted-foreground">No device data</div>
              )}
            </div>
          </TechCard>
          
          <TechCard title="Registered Personnel" subtitle="Active users">
             {usersLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground animate-pulse">Loading...</div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto mt-4 pr-1">
                {allUsers.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">No users found</div>
                ) : (
                  allUsers.map((user: UserEntry) => (
                    <div key={user.id} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/5">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none truncate">{user.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize mt-1">{user.role}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </TechCard>
        </div>
      </div>

      {/* AI Log Analysis Modal */}
      {selectedAiLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-indigo-500/30 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl shadow-indigo-500/20">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-indigo-500/10">
              <div className="flex items-center gap-2 text-indigo-400 font-bold">
                <Sparkles className="w-5 h-5" />
                <span>AI Risk Analysis</span>
              </div>
              <button onClick={() => setSelectedAiLog(null)} className="text-muted-foreground hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="text-xs font-mono text-muted-foreground mb-4 p-3 bg-white/5 rounded-lg border border-white/5">
                <p>Event ID: {selectedAiLog.id}</p>
                <p>Status: {selectedAiLog.status} | Risk: {selectedAiLog.riskScore} ({selectedAiLog.riskLevel})</p>
                <p>Device: {selectedAiLog.device} | IP: {selectedAiLog.ipAddress}</p>
              </div>
              <div className="text-sm text-white/90">
                {isAnalyzing ? (
                  <div className="flex items-center gap-3 animate-pulse text-indigo-300">
                    <Brain className="w-5 h-5" />
                    <span>Groq is analyzing threat patterns...</span>
                  </div>
                ) : aiAnalysis ? (
                  <div className="prose prose-invert max-w-none">
                    {aiAnalysis.split('\n').map((line: string, i: number) => (
                      <p key={i} className="mb-2">{line}</p>
                    ))}
                  </div>
                ) : (
                  <span className="text-red-400">Analysis failed.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-display font-semibold">Manager Overview</h2>
          <p className="text-sm text-muted-foreground">Team attendance and access logs</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TechCard className="bg-primary/5 border-primary/20 p-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-lg text-primary"><Users className="w-6 h-6" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Team Members</p>
              <h2 className="text-3xl font-mono font-bold">{totalEmployees}</h2>
            </div>
          </div>
        </TechCard>
        
        <TechCard className="bg-emerald-500/5 border-emerald-500/20 p-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-lg text-emerald-400"><CheckCircle className="w-6 h-6" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Today's Check-ins</p>
              <h2 className="text-3xl font-mono font-bold text-emerald-400">{successLogs.length}</h2>
            </div>
          </div>
        </TechCard>

        <TechCard className="bg-blue-500/5 border-blue-500/20 p-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400"><Clock className="w-6 h-6" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Present Today</p>
              <h2 className="text-3xl font-mono font-bold text-blue-400">{Math.min(successLogs.length, totalEmployees)}</h2>
            </div>
          </div>
        </TechCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TechCard title="Team Overview" subtitle="Employee attendance summary">
          <div className="space-y-3 mt-4">
            {allUsers.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">No team members registered</div>
            ) : (
              allUsers.slice(0, 10).map((user: UserEntry) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-lg hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shadow-inner">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-white/90">{user.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{user.role}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 rounded-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    PRESENT
                  </span>
                </div>
              ))
            )}
          </div>
        </TechCard>

        <TechCard title="Recent Activity" subtitle="Live team access logs">
          <div className="space-y-3 mt-4">
            {successLogs.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">No recent activity</div>
            ) : (
              successLogs.slice(0, 5).map((log: any, idx: any) => (
                <div key={log.id || idx} className="flex items-center gap-4 p-3 bg-white/5 border border-white/5 rounded-lg hover:bg-white/10 transition-colors">
                  <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/90">User Access Granted</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">ID: {log.userId?.substring(0, 8) || 'Unknown'}</p>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono bg-black/20 px-2 py-1 rounded">
                    {log.timestamp ? format(log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp), "HH:mm:ss") : '-'}
                  </div>
                </div>
              ))
            )}
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
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 mt-4">
      <TechCard className="text-center py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-primary/30 shadow-[0_0_30px_rgba(var(--primary),0.2)]">
          <Fingerprint className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-4xl font-display font-bold mb-2 tracking-tight">Welcome Back</h2>
        <p className="text-muted-foreground text-lg mb-10">{employeeName}</p>
        
        <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
          <div className="p-6 rounded-xl bg-white/5 border border-white/10 shadow-sm">
            <div className="flex justify-center mb-2"><CheckCircle className="w-6 h-6 text-emerald-400" /></div>
            <div className="text-3xl font-bold font-mono text-emerald-400 mb-1">09:00</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Clock In</div>
          </div>
          <div className="p-6 rounded-xl bg-white/5 border border-white/10 opacity-50 border-dashed">
            <div className="flex justify-center mb-2"><Clock className="w-6 h-6 text-muted-foreground" /></div>
            <div className="text-3xl font-bold font-mono text-muted-foreground mb-1">--:--</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Clock Out</div>
          </div>
        </div>
      </TechCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="group p-6 rounded-xl bg-card border border-white/5 hover:border-primary/40 hover:bg-white/5 transition-all duration-300 cursor-pointer">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
              <User className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-bold text-lg">My Profile</h3>
          </div>
          <p className="text-sm text-muted-foreground">Update personal information and view biometric status.</p>
        </div>
        <div className="group p-6 rounded-xl bg-card border border-white/5 hover:border-primary/40 hover:bg-white/5 transition-all duration-300 cursor-pointer">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-bold text-lg">Work Schedule</h3>
          </div>
          <p className="text-sm text-muted-foreground">View upcoming shifts and request time off.</p>
        </div>
        <div className="group p-6 rounded-xl bg-card border border-white/5 hover:border-primary/40 hover:bg-white/5 transition-all duration-300 cursor-pointer">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-bold text-lg">My Attendance</h3>
          </div>
          <p className="text-sm text-muted-foreground">View your attendance history and statistics.</p>
        </div>
        <div className="group p-6 rounded-xl bg-card border border-white/5 hover:border-primary/40 hover:bg-white/5 transition-all duration-300 cursor-pointer">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
              <FileText className="w-6 h-6 text-primary" />
            </div>
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
  const [activeTab, setActiveTab] = useState<'overview' | 'ai_eval' | 'alerts'>('overview');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [groqKeyInput, setGroqKeyInput] = useState(localStorage.getItem('groq_api_key') || '');
  const [hasApiKey, setHasApiKey] = useState(!!localStorage.getItem('groq_api_key'));
  const { toast } = useToast();

  const handleSaveGroqKey = () => {
    localStorage.setItem('groq_api_key', groqKeyInput.trim());
    setHasApiKey(true);
    setIsSettingsOpen(false);
    toast({
      title: "Settings Saved",
      description: "Your Groq API Key has been updated.",
    });
  };
  
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
    if (activeTab === 'ai_eval') {
      return <AiEvaluationView />;
    }
    if (activeTab === 'alerts') {
      return <AgentAlertsView />;
    }

    switch (role) {
      case 'admin':
        return <AdminView hasApiKey={hasApiKey} />;
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
          <>
            <Button 
              variant={activeTab === 'overview' ? "secondary" : "ghost"} 
              className="w-full justify-start"
              onClick={() => setActiveTab('overview')}
            >
              <LayoutDashboard className="w-4 h-4 mr-3" /> Overview
            </Button>
            <Button 
              variant={activeTab === 'alerts' ? "secondary" : "ghost"} 
              className="w-full justify-start text-rose-400 hover:text-rose-300"
              onClick={() => setActiveTab('alerts')}
            >
              <ShieldAlert className="w-4 h-4 mr-3" /> Threat Alerts
            </Button>
            <Button 
              variant={activeTab === 'ai_eval' ? "secondary" : "ghost"} 
              className="w-full justify-start"
              onClick={() => setActiveTab('ai_eval')}
            >
              <BrainCircuit className="w-4 h-4 mr-3" /> AI Evaluation
            </Button>
          </>
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
          <Button 
            variant="ghost" 
            className="w-full justify-start"
            onClick={() => setIsSettingsOpen(true)}
          >
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
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <div className="text-sm font-mono text-muted-foreground">{format(new Date(), "EEEE, MMMM dd, yyyy")}</div>
              <div className="text-lg font-mono">{format(new Date(), "HH:mm:ss")}</div>
            </div>
          </div>
        </header>

        {renderView()}
      </main>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-400" />
              System Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Groq API Key (For AI Features)</label>
              <Input 
                type="password" 
                placeholder="gsk_..." 
                value={groqKeyInput}
                onChange={(e) => setGroqKeyInput(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50 focus-visible:ring-indigo-500 font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Stored securely in your browser's local storage. Required for AI insights.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveGroqKey} className="bg-indigo-500 hover:bg-indigo-600 text-white">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

