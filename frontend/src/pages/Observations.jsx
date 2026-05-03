import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/api";
import { PageHeader, SectionHeader, SeverityBadge, StatusBadge } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import InsightsSection from "@/components/InsightsSection";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { fmtDate, formatINR } from "@/lib/format";
import { Sparkles, Plus, Eye, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["all","Submitted","Response_Pending","Action_Plan_Submitted","In_Progress","Evidence_Submitted","Under_Review","Closed","Reopened"];
const NEXT_TRANSITIONS = {
  Draft: ["Submitted"], Submitted: ["Response_Pending", "Closed"],
  Response_Pending: ["Action_Plan_Submitted"], Action_Plan_Submitted: ["In_Progress"],
  In_Progress: ["Evidence_Submitted","Closed"], Evidence_Submitted: ["Under_Review"],
  Under_Review: ["Closed","Reopened"], Closed: ["Reopened"], Reopened: ["In_Progress"],
};

export default function Observations() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState({ status: "all", severity: "all" });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [aiPlan, setAiPlan] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", severity: "Medium", root_cause: "", business_impact: "", financial_impact: 0 });

  const load = async () => {
    setLoading(true);
    const params = {};
    if (filter.status !== "all") params.status = filter.status;
    if (filter.severity !== "all") params.severity = filter.severity;
    const cc = searchParams.get("control_code");
    const sl = searchParams.get("sla_status");
    if (cc) params.control_code = cc;
    if (sl) params.sla_status = sl;
    const r = await api.get("/observations", { params });
    setItems(r.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter, searchParams]);

  const transition = async (id, newStatus) => {
    try {
      await api.post(`/observations/${id}/transition`, { new_status: newStatus });
      toast.success(`Moved to ${newStatus}`);
      load();
      if (selected) {
        const r = await api.get(`/observations/${id}`);
        setSelected(r.data);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Transition failed");
    }
  };

  const aiSuggest = async (id) => {
    setAiBusy(true); setAiPlan(null);
    try {
      const r = await api.post(`/ai/observations/${id}/remediation-plan`);
      setAiPlan(r.data);
      toast.success("AI plan generated");
    } catch (e) { toast.error("AI failed"); }
    finally { setAiBusy(false); }
  };

  const create = async () => {
    try {
      await api.post("/observations", form);
      toast.success("Observation created");
      setCreateOpen(false);
      setForm({ title: "", description: "", severity: "Medium", root_cause: "", business_impact: "", financial_impact: 0 });
      load();
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="space-y-6" data-testid="observations-page">
      <PageHeader eyebrow="FINDINGS WORKFLOW" title="Observations" subtitle={`${items.length} observations · State machine workflow`}
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-sm bg-blue-700 hover:bg-blue-800" data-testid="new-observation-btn"><Plus className="w-3.5 h-3.5 mr-1" /> New Observation</Button>
            </DialogTrigger>
            <DialogContent className="rounded-sm max-w-2xl">
              <DialogHeader><DialogTitle className="font-display tracking-tight">Raise Observation</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label className="crt-overline text-[10px]">Title</Label><Input className="rounded-sm mt-1" value={form.title} onChange={e => setForm({...form, title: e.target.value})} data-testid="obs-title-input" /></div>
                <div><Label className="crt-overline text-[10px]">Description</Label><Textarea className="rounded-sm mt-1" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="crt-overline text-[10px]">Severity</Label>
                    <Select value={form.severity} onValueChange={v => setForm({...form, severity: v})}>
                      <SelectTrigger className="rounded-sm mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{["Critical","High","Medium","Low"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="crt-overline text-[10px]">Financial Impact (₹)</Label><Input type="number" className="rounded-sm mt-1" value={form.financial_impact} onChange={e => setForm({...form, financial_impact: parseFloat(e.target.value) || 0})} /></div>
                </div>
                <div><Label className="crt-overline text-[10px]">Root Cause</Label><Textarea className="rounded-sm mt-1" rows={2} value={form.root_cause} onChange={e => setForm({...form, root_cause: e.target.value})} /></div>
                <div><Label className="crt-overline text-[10px]">Business Impact</Label><Textarea className="rounded-sm mt-1" rows={2} value={form.business_impact} onChange={e => setForm({...form, business_impact: e.target.value})} /></div>
                <Button onClick={create} className="w-full rounded-sm bg-blue-700 hover:bg-blue-800" data-testid="obs-create-submit">Create Observation</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <InsightsSection scope="observations" eyebrow="OBSERVATIONS · COCKPIT" title="Observations AI Insights" />

      <div className="crt-card p-4 flex gap-3 flex-wrap">
        <Select value={filter.status} onValueChange={v => setFilter({...filter, status: v})}>
          <SelectTrigger className="rounded-sm w-52" data-testid="obs-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s === "all" ? "All Statuses" : s.replace(/_/g," ")}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filter.severity} onValueChange={v => setFilter({...filter, severity: v})}>
          <SelectTrigger className="rounded-sm w-44" data-testid="obs-severity-filter"><SelectValue /></SelectTrigger>
          <SelectContent>{["all","Critical","High","Medium","Low"].map(s => <SelectItem key={s} value={s}>{s === "all" ? "All Severities" : s}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {loading ? <Skeleton className="h-96" /> : (
        <div className="crt-card p-0 overflow-hidden">
          <table className="w-full text-xs crt-table">
            <thead className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <tr>
                <th className="text-left py-2 px-3">Title</th>
                <th className="text-left px-2">Severity</th>
                <th className="text-left px-2">Status</th>
                <th className="text-right px-2">Exposure</th>
                <th className="text-left px-2">Owner</th>
                <th className="text-left px-2">Due</th>
                <th className="text-left px-2">SLA</th>
                <th className="text-right px-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(o => (
                <tr key={o.observation_id} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="py-2.5 px-3 font-medium max-w-md truncate">{o.title}</td>
                  <td className="px-2"><SeverityBadge value={o.severity} /></td>
                  <td className="px-2"><StatusBadge value={o.status} /></td>
                  <td className="px-2 text-right crt-num">{formatINR(o.financial_impact)}</td>
                  <td className="px-2 text-zinc-500 text-[11px]">{o.owner_name || "—"}</td>
                  <td className="px-2 font-mono text-[10px] text-zinc-500">{fmtDate(o.due_date)}</td>
                  <td className="px-2"><StatusBadge value={o.sla_status} /></td>
                  <td className="px-3 text-right flex items-center justify-end gap-1">
                    <Link to={`/observations/${o.observation_id}`} className="text-[10px] font-bold text-blue-700 dark:text-blue-400 hover:underline px-2" data-testid={`obs-page-link-${o.observation_id}`}>Page</Link>
                    <Button size="sm" variant="ghost" className="rounded-sm h-7 text-xs" data-testid={`obs-view-${o.observation_id}`} onClick={async () => {
                      const r = await api.get(`/observations/${o.observation_id}`);
                      setSelected(r.data); setAiPlan(null);
                    }}><Eye className="w-3 h-3 mr-1" /> View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="w-[600px] sm:max-w-2xl overflow-y-auto rounded-none" data-testid="obs-detail-drawer">
          {selected && (
            <>
              <SheetHeader className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                  <SeverityBadge value={selected.severity} />
                  <StatusBadge value={selected.status} />
                </div>
                <SheetTitle className="font-display tracking-tight">{selected.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="crt-overline mb-1">Description</div>
                  <p className="text-sm">{selected.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><div className="crt-overline mb-1">Due Date</div><div className="font-mono text-sm">{fmtDate(selected.due_date)}</div></div>
                  <div><div className="crt-overline mb-1">Financial Impact</div><div className="font-mono text-sm">{formatINR(selected.financial_impact)}</div></div>
                </div>
                {selected.root_cause && (<div><div className="crt-overline mb-1">Root Cause</div><p className="text-sm">{selected.root_cause}</p></div>)}
                {selected.business_impact && (<div><div className="crt-overline mb-1">Business Impact</div><p className="text-sm">{selected.business_impact}</p></div>)}

                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                  <div className="crt-overline mb-2">State Transitions</div>
                  <div className="flex flex-wrap gap-2">
                    {(NEXT_TRANSITIONS[selected.status] || []).map(t => (
                      <Button key={t} size="sm" variant="outline" className="rounded-sm" onClick={() => transition(selected.observation_id, t)} data-testid={`transition-${t}`}>
                        → {t.replace(/_/g," ")}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                  <Button onClick={() => aiSuggest(selected.observation_id)} disabled={aiBusy} className="rounded-sm bg-blue-700 hover:bg-blue-800 w-full" data-testid="ai-suggest-fix-btn">
                    <Sparkles className="w-3.5 h-3.5 mr-2" /> {aiBusy ? "AI thinking..." : "AI: Suggest Remediation Plan"}
                  </Button>
                  {aiPlan && (
                    <Accordion type="single" collapsible className="mt-3" defaultValue="immediate">
                      {[["immediate","Immediate Actions","immediate_actions"],["short","Short-Term Fixes","short_term_fixes"],["long","Long-Term Preventive","long_term_preventive"],["validate","Validation Steps","validation_steps"]].map(([key,label,prop]) => (
                        <AccordionItem key={key} value={key} className="border-zinc-200 dark:border-zinc-800">
                          <AccordionTrigger className="text-sm font-semibold">{label}</AccordionTrigger>
                          <AccordionContent>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                              {(aiPlan[prop] || []).map((x, i) => <li key={i}>{x}</li>)}
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                      <AccordionItem value="meta" className="border-zinc-200 dark:border-zinc-800">
                        <AccordionTrigger className="text-sm font-semibold">Effort & Tools</AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-zinc-500">Effort:</span> {aiPlan.estimated_effort_hours}h</div>
                            <div><span className="text-zinc-500">Risk Reduction:</span> {aiPlan.expected_risk_reduction_pct}%</div>
                            <div><span className="text-zinc-500">Owner:</span> {aiPlan.recommended_owner_role}</div>
                            <div><span className="text-zinc-500">Tools:</span> {(aiPlan.tools_or_systems_to_use || []).join(", ")}</div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
