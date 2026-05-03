import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/api";
import { PageHeader, SectionHeader, SeverityBadge, StatusBadge } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import InsightsSection from "@/components/InsightsSection";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import { Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Risks() {
  const [searchParams] = useSearchParams();
  const [risks, setRisks] = useState([]);
  const [aiResults, setAiResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const p = {};
    const sev = searchParams.get("severity");
    const st = searchParams.get("status");
    const cat = searchParams.get("category");
    const hl = searchParams.get("heatmap_likelihood");
    const hi = searchParams.get("heatmap_impact");
    if (sev) p.severity = sev;
    if (st) p.status = st;
    if (cat) p.category = cat;
    if (hl) p.heatmap_likelihood = hl;
    if (hi) p.heatmap_impact = hi;
    setLoading(true);
    api.get("/risks", { params: p }).then(r => setRisks(r.data)).finally(() => setLoading(false));
  }, [searchParams]);

  const aiPrioritize = async () => {
    setBusy(true);
    try {
      const r = await api.post("/ai/prioritize-risks");
      setAiResults(r.data);
      toast.success("AI prioritization complete");
      const p = Object.fromEntries(searchParams.entries());
      const r2 = await api.get("/risks", { params: p });
      setRisks(r2.data);
    } catch { toast.error("AI failed"); }
    finally { setBusy(false); }
  };

  if (loading) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-6" data-testid="risks-page">
      <PageHeader eyebrow={`${risks.length} TRACKED RISKS`} title="Risk Register" subtitle="Likelihood × Impact × Control Weakness Factor"
        actions={<Button onClick={aiPrioritize} disabled={busy} size="sm" className="rounded-sm bg-blue-700 hover:bg-blue-800" data-testid="ai-prioritize-btn"><Sparkles className="w-3.5 h-3.5 mr-1" /> {busy ? "AI working…" : "AI: Prioritize for Board"}</Button>}
      />

      <InsightsSection scope="risks" eyebrow="RISKS · COCKPIT" title="Risk AI Insights" />

      {aiResults && (
        <div className="crt-card p-5 border-blue-300 dark:border-blue-800">
          <SectionHeader eyebrow="AI BOARD-READY ANALYSIS · TOP 10"><Sparkles className="w-3.5 h-3.5 inline-block mr-1 text-blue-600" /> CISO Recommendations</SectionHeader>
          <div className="space-y-2">
            {aiResults.map(r => (
              <div key={r.original_risk_id} className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-sm">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 bg-blue-700 dark:bg-blue-600 text-white text-xs font-bold rounded-sm flex items-center justify-center">P{r.priority_rank}</span>
                    <div className="font-display font-bold text-sm tracking-tight">{r.board_ready_title}</div>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${r.urgency === 'Fix_Today' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' : r.urgency === 'Fix_This_Week' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'}`}>{r.urgency}</span>
                </div>
                <div className="text-xs text-zinc-700 dark:text-zinc-300 mb-2">{r.one_line_business_impact}</div>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-500">
                  <span className="font-mono font-bold text-red-600">{formatINR(r.financial_exposure_inr)}</span>
                  <span>·</span>
                  <span>Owner: {r.owner_role}</span>
                </div>
                <div className="text-[11px] text-blue-700 dark:text-blue-400 mt-1.5">→ {r.recommended_action}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="crt-card overflow-hidden">
        <table className="w-full text-xs crt-table">
          <thead className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <tr>
              <th className="text-left py-2 px-3">Title</th>
              <th className="text-left px-2">Category</th>
              <th className="text-left px-2">Severity</th>
              <th className="text-right px-2">L×I×CWF</th>
              <th className="text-right px-2">Score</th>
              <th className="text-right px-2">Exposure</th>
              <th className="text-left px-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {risks.map(r => (
              <tr key={r.risk_id} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                <td className="py-2.5 px-3 font-medium max-w-md"><Link to={`/risks/${r.risk_id}`} className="text-blue-700 dark:text-blue-400 hover:underline" data-testid={`risk-row-${r.risk_id}`}>{r.title}</Link></td>
                <td className="px-2 text-zinc-500">{r.category}</td>
                <td className="px-2"><SeverityBadge value={r.severity} /></td>
                <td className="px-2 text-right font-mono text-[10px] text-zinc-500">{r.likelihood}×{r.impact}×{r.control_weakness_factor}</td>
                <td className="px-2 text-right crt-num font-bold">{r.risk_score?.toFixed(1)}</td>
                <td className="px-2 text-right crt-num">{formatINR(r.financial_impact)}</td>
                <td className="px-2"><StatusBadge value={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
