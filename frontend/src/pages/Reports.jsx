import React, { useState } from "react";
import api from "@/api";
import { PageHeader, SectionHeader } from "@/components/Primitives";
import { Button } from "@/components/ui/button";
import { FileText, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Reports() {
  const [busy, setBusy] = useState(null);

  const downloadFile = async (url, filename, busyKey) => {
    setBusy(busyKey);
    try {
      const r = await api.post(url, {}, { responseType: "blob" });
      const blob = new Blob([r.data]);
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u; a.download = filename; a.click();
      URL.revokeObjectURL(u);
      toast.success("Report downloaded");
    } catch (e) { toast.error("Download failed"); }
    finally { setBusy(null); }
  };

  const reports = [
    {
      key: "cio-summary",
      title: "CIO Summary Report",
      desc: "Board-ready PDF with enterprise score, top 10 risks, framework readiness, and recommendations.",
      icon: FileText, accent: "text-blue-700 bg-blue-50 dark:bg-blue-950/40",
      action: () => downloadFile("/reports/cio-summary", `cio-summary-${new Date().toISOString().slice(0,10)}.pdf`, "cio"),
    },
    {
      key: "remediation-excel",
      title: "Remediation Tracker",
      desc: "Excel workbook with all observations, owner performance, and SLA breaches.",
      icon: FileSpreadsheet, accent: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40",
      action: () => downloadFile("/reports/remediation-excel", `remediation-${new Date().toISOString().slice(0,10)}.xlsx`, "rem"),
    },
  ];

  return (
    <div className="space-y-6" data-testid="reports-page">
      <PageHeader eyebrow="EXPORT" title="Reports & Exports" subtitle="Generate board-ready documents in seconds" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map(r => (
          <div key={r.key} className="crt-card p-6">
            <div className={`w-12 h-12 rounded-sm flex items-center justify-center mb-4 ${r.accent}`}>
              <r.icon className="w-6 h-6" />
            </div>
            <h3 className="font-display font-black text-xl tracking-tight mb-2">{r.title}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">{r.desc}</p>
            <Button onClick={r.action} disabled={busy === r.key.split("-")[0]} className="rounded-sm bg-blue-700 hover:bg-blue-800" data-testid={`report-${r.key}-btn`}>
              {busy === r.key.split("-")[0] ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-2" />}
              Generate & Download
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
