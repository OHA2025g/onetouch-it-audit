import React, { useEffect, useState } from "react";
import api from "@/api";
import { PageHeader, SectionHeader, StatusBadge } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import InsightsSection from "@/components/InsightsSection";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, ListChecks } from "lucide-react";

export default function Audits() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ audit_name: "", audit_type: "IT_General", framework: "ITGC", scope_description: "", objective: "" });

  const load = () => api.get("/audits").then(r => setAudits(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await api.post("/audits", form);
      toast.success("Audit created");
      setOpen(false);
      setForm({ audit_name: "", audit_type: "IT_General", framework: "ITGC", scope_description: "", objective: "" });
      load();
    } catch (e) { toast.error("Failed to create"); }
  };

  if (loading) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-6" data-testid="audits-page">
      <PageHeader eyebrow="LIFECYCLE" title="Audit Plans" subtitle={`${audits.length} audits across the lifecycle`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-sm bg-blue-700 hover:bg-blue-800" data-testid="new-audit-btn"><Plus className="w-3.5 h-3.5 mr-1" /> New Audit</Button>
            </DialogTrigger>
            <DialogContent className="rounded-sm">
              <DialogHeader><DialogTitle className="font-display tracking-tight">Create Audit Plan</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label className="crt-overline text-[10px]">Audit Name</Label><Input className="rounded-sm mt-1" value={form.audit_name} onChange={e => setForm({...form, audit_name: e.target.value})} data-testid="audit-name-input" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="crt-overline text-[10px]">Type</Label>
                    <Select value={form.audit_type} onValueChange={v => setForm({...form, audit_type: v})}>
                      <SelectTrigger className="rounded-sm mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{["IT_General","Cybersecurity","Application","Cloud","Vendor","Compliance","Infrastructure","Data_Privacy","DevSecOps"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="crt-overline text-[10px]">Framework</Label>
                    <Select value={form.framework} onValueChange={v => setForm({...form, framework: v})}>
                      <SelectTrigger className="rounded-sm mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{["ITGC","ISO27001","SOC2","DPDP","RBI_IT","SEBI_Cyber","CERT_In","IFC","Internal"].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label className="crt-overline text-[10px]">Scope</Label><Textarea className="rounded-sm mt-1" rows={3} value={form.scope_description} onChange={e => setForm({...form, scope_description: e.target.value})} /></div>
                <div><Label className="crt-overline text-[10px]">Objective</Label><Textarea className="rounded-sm mt-1" rows={3} value={form.objective} onChange={e => setForm({...form, objective: e.target.value})} /></div>
                <Button onClick={submit} className="w-full rounded-sm bg-blue-700 hover:bg-blue-800" data-testid="audit-create-submit">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <InsightsSection scope="audits" eyebrow="AUDITS · COCKPIT" title="Audit AI Insights" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {audits.map(a => (
          <div key={a.audit_id} className="crt-card p-4 hover:border-blue-300 dark:hover:border-blue-800 cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-zinc-500">{a.audit_type}</span>
              <StatusBadge value={a.status} />
            </div>
            <div className="font-display font-bold text-base tracking-tight mb-1">{a.audit_name}</div>
            <div className="text-xs text-zinc-500 mb-3 line-clamp-2">{a.scope_description}</div>
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <span>{a.framework}</span>
              <span>{fmtDate(a.start_date)} → {fmtDate(a.end_date)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
