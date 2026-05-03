import React, { useEffect, useState } from "react";
import api from "@/api";
import { PageHeader, SectionHeader, StatusBadge } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import InsightsSection from "@/components/InsightsSection";
import { Button } from "@/components/ui/button";
import { Sparkles, Upload, FileSearch, FileText } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

export default function Evidence() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(null);

  const load = () => api.get("/evidence").then(r => setItems(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const upload = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post("/evidence/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${file.name} uploaded`);
      load();
    } catch { toast.error("Upload failed"); }
  };

  const validate = async (id) => {
    setValidating(id);
    try {
      const r = await api.post(`/ai/evidence/${id}/validate`);
      toast.success(`AI: ${r.data.overall_status}`);
      load();
    } catch { toast.error("Validation failed"); }
    finally { setValidating(null); }
  };

  return (
    <div className="space-y-6" data-testid="evidence-page">
      <PageHeader eyebrow="HASH-VERIFIED ARTIFACTS" title="Evidence Management" subtitle="Upload audit evidence with AI sufficiency scoring + SHA-256 integrity"
        actions={
          <label className="cursor-pointer">
            <input type="file" hidden onChange={e => e.target.files?.[0] && upload(e.target.files[0])} data-testid="evidence-upload-input" />
            <Button asChild size="sm" className="rounded-sm bg-blue-700 hover:bg-blue-800">
              <span><Upload className="w-3.5 h-3.5 mr-1" /> Upload Evidence</span>
            </Button>
          </label>
        }
      />
      <InsightsSection scope="evidence" eyebrow="EVIDENCE · COCKPIT" title="Evidence AI Insights" />
      {loading ? <Skeleton className="h-96" /> : (
        <div className="crt-card overflow-hidden">
          <table className="w-full text-xs crt-table">
            <thead className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <tr>
                <th className="text-left py-2 px-3">File</th>
                <th className="text-left px-2">Uploaded By</th>
                <th className="text-left px-2">Date</th>
                <th className="text-right px-2">Size</th>
                <th className="text-left px-2">Hash</th>
                <th className="text-left px-2">AI Validation</th>
                <th className="text-right px-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(e => (
                <tr key={e.evidence_id} className="border-b border-zinc-100 dark:border-zinc-800/60">
                  <td className="py-2 px-3"><div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-zinc-400" /><span className="font-medium">{e.file_name}</span></div></td>
                  <td className="px-2 text-zinc-500">{e.uploader_name}</td>
                  <td className="px-2 font-mono text-[10px] text-zinc-500">{fmtDate(e.created_at)}</td>
                  <td className="px-2 text-right crt-num">{(e.file_size_bytes / 1024).toFixed(1)}KB</td>
                  <td className="px-2 font-mono text-[10px] text-zinc-400">{e.hash_value?.slice(0, 12)}...</td>
                  <td className="px-2"><StatusBadge value={e.ai_validation_status} /></td>
                  <td className="px-3 text-right">
                    <Button size="sm" variant="ghost" className="rounded-sm h-7 text-xs" disabled={validating === e.evidence_id} onClick={() => validate(e.evidence_id)} data-testid={`validate-evidence-${e.evidence_id}`}>
                      <Sparkles className="w-3 h-3 mr-1" /> {validating === e.evidence_id ? "..." : "Validate"}
                    </Button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-zinc-400">No evidence uploaded yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
