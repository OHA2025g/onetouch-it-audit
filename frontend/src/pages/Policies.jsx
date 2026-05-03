import React, { useEffect, useState } from "react";
import api from "@/api";
import { PageHeader, SectionHeader, StatusBadge, SeverityBadge } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import InsightsSection from "@/components/InsightsSection";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";
import { Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";

export default function Policies() {
  const [policies, setPolicies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [gaps, setGaps] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get("/policies").then(r => setPolicies(r.data)).finally(() => setLoading(false)); }, []);

  const runGap = async (id) => {
    setBusy(true); setGaps(null);
    try {
      const r = await api.post(`/ai/policies/${id}/gaps`);
      setGaps(r.data);
      toast.success("Gap analysis complete");
    } catch { toast.error("Failed"); }
    finally { setBusy(false); }
  };

  if (loading) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-6" data-testid="policies-page">
      <PageHeader eyebrow="GOVERNANCE LIBRARY" title="Policy Management" subtitle={`${policies.length} policies · AI-powered gap analysis`} />
      <InsightsSection scope="policies" eyebrow="POLICIES · COCKPIT" title="Policy AI Insights" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {policies.map(p => (
          <div key={p.policy_id} className="crt-card p-4 cursor-pointer hover:border-blue-300 dark:hover:border-blue-800" onClick={() => { setSelected(p); setGaps(null); }} data-testid={`policy-card-${p.policy_id}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-blue-700 dark:text-blue-400 font-bold">{p.policy_code}</span>
              <StatusBadge value={p.status} />
            </div>
            <div className="flex items-start gap-2 mb-2">
              <FileText className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
              <div className="font-display font-bold text-sm tracking-tight">{p.policy_name}</div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <span>v{p.version}</span>
              <span>Next review: {fmtDate(p.next_review_date)}</span>
            </div>
            {p.exception_count > 0 && (
              <div className="mt-2 text-[10px] text-amber-600">{p.exception_count} active exception(s)</div>
            )}
          </div>
        ))}
      </div>

      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="w-[600px] sm:max-w-2xl overflow-y-auto rounded-none">
          {selected && (
            <>
              <SheetHeader className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-mono text-blue-700 dark:text-blue-400 font-bold">{selected.policy_code}</span><StatusBadge value={selected.status} /></div>
                <SheetTitle className="font-display tracking-tight">{selected.policy_name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><div className="crt-overline mb-1">Version</div><div className="font-mono">{selected.version}</div></div>
                  <div><div className="crt-overline mb-1">Type</div><div>{selected.policy_type}</div></div>
                  <div><div className="crt-overline mb-1">Effective Date</div><div className="font-mono">{fmtDate(selected.effective_date)}</div></div>
                  <div><div className="crt-overline mb-1">Next Review</div><div className="font-mono">{fmtDate(selected.next_review_date)}</div></div>
                </div>
                <div>
                  <div className="crt-overline mb-1">Policy Content</div>
                  <div className="text-xs whitespace-pre-wrap p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm leading-relaxed">{selected.content}</div>
                </div>
                <Button onClick={() => runGap(selected.policy_id)} disabled={busy} className="w-full rounded-sm bg-blue-700 hover:bg-blue-800" data-testid="run-gap-analysis-btn">
                  <Sparkles className="w-3.5 h-3.5 mr-2" /> {busy ? "Analyzing…" : "AI: Run Gap Analysis"}
                </Button>
                {gaps && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3">
                    <div>
                      <div className="crt-overline mb-1">Compliance</div>
                      <div className="font-display font-black text-2xl crt-num">{gaps.compliance_pct}%</div>
                    </div>
                    <div>
                      <div className="crt-overline mb-1">Summary</div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">{gaps.summary}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="crt-overline">Gaps Identified</div>
                      {(gaps.gaps || []).map((g, i) => (
                        <div key={i} className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-sm">
                          <div className="flex items-center gap-2 mb-1"><SeverityBadge value={g.severity} /></div>
                          <div className="text-xs font-medium mb-1">{g.gap_description}</div>
                          <div className="text-[10px] text-zinc-500 mb-1">Clause: {g.policy_clause}</div>
                          <div className="text-[10px] text-zinc-500 mb-1">Actual: {g.actual_state}</div>
                          <div className="text-[11px] text-blue-700 dark:text-blue-400">→ {g.recommendation}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
