import { useEvals, useRunEval } from "@/hooks/use-evals";
import { Button } from "@/components/ui/button";
import { BrainCircuit, CheckCircle, XCircle, Clock, PlayCircle } from "lucide-react";

function TechCard({ title, subtitle, children, className = "" }: { title: string, subtitle?: string, children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-card/50 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col ${className}`}>
      <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
        <div>
          <h3 className="font-display font-semibold text-lg tracking-tight text-white/90">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-4 flex-1">
        {children}
      </div>
    </div>
  );
}

export function AiEvaluationView() {
  const { data: evals, isLoading } = useEvals();
  const runEval = useRunEval();

  const latestEval = evals && evals.length > 0 ? evals[0] : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-white mb-2">Agent Evaluation</h2>
          <p className="text-muted-foreground text-sm">
            Benchmark the Groq Security Agent against golden datasets.
          </p>
        </div>
        <Button 
          onClick={() => runEval.mutate()}
          disabled={runEval.isPending}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {runEval.isPending ? (
            <span className="flex items-center"><Clock className="w-4 h-4 mr-2 animate-spin" /> Running Benchmark...</span>
          ) : (
            <span className="flex items-center"><PlayCircle className="w-4 h-4 mr-2" /> Run AI Evaluation</span>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TechCard title="Accuracy Score" subtitle="Percentage of correct predictions">
          <div className="flex items-center h-full pt-4">
            <BrainCircuit className="w-12 h-12 text-indigo-400 mr-4 opacity-50" />
            <div>
              <div className="text-5xl font-display font-bold text-white">
                {latestEval ? `${latestEval.metrics.accuracy_score}%` : '--%'}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Higher is better (Target: &gt;90%)
              </p>
            </div>
          </div>
        </TechCard>

        <TechCard title="False Positives" subtitle="Safe logins flagged as threats">
          <div className="flex items-center h-full pt-4">
            <XCircle className="w-12 h-12 text-rose-400 mr-4 opacity-50" />
            <div>
              <div className="text-5xl font-display font-bold text-white">
                {latestEval ? latestEval.metrics.false_positives : '--'}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Lower is better (Target: 0)
              </p>
            </div>
          </div>
        </TechCard>

        <TechCard title="Average Latency" subtitle="Response time per log">
          <div className="flex items-center h-full pt-4">
            <Clock className="w-12 h-12 text-amber-400 mr-4 opacity-50" />
            <div>
              <div className="text-5xl font-display font-bold text-white">
                {latestEval ? `${latestEval.metrics.average_latency_ms}ms` : '--ms'}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Lower is better
              </p>
            </div>
          </div>
        </TechCard>
      </div>

      <TechCard title="Historical Evaluations" subtitle="Recent benchmark runs">
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-8">Loading history...</div>
        ) : !evals || evals.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8 italic">No evaluations have been run yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-white/80">
              <thead className="text-xs uppercase bg-white/5 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Date</th>
                  <th className="px-4 py-3">Total Evaluated</th>
                  <th className="px-4 py-3">Accuracy</th>
                  <th className="px-4 py-3">False Positives</th>
                  <th className="px-4 py-3">False Negatives</th>
                  <th className="px-4 py-3 rounded-tr-lg">Latency</th>
                </tr>
              </thead>
              <tbody>
                {evals.map((evalRun, idx) => (
                  <tr key={evalRun.id} className={`border-b border-white/5 ${idx === 0 ? 'bg-indigo-500/10' : ''}`}>
                    <td className="px-4 py-3">{new Date(evalRun.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono">{evalRun.metrics.total_evaluated}</td>
                    <td className="px-4 py-3 font-mono text-emerald-400 font-bold">{evalRun.metrics.accuracy_score}%</td>
                    <td className="px-4 py-3 font-mono">{evalRun.metrics.false_positives}</td>
                    <td className="px-4 py-3 font-mono">{evalRun.metrics.false_negatives}</td>
                    <td className="px-4 py-3 font-mono">{evalRun.metrics.average_latency_ms}ms</td>
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
