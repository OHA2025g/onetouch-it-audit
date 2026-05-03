import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/api";
import EntityDetailLayout from "@/components/EntityDetailLayout";
import { SeverityBadge, StatusBadge, SectionHeader } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR, fmtDate } from "@/lib/format";

export default function ObservationDetail() {
  const { obsId } = useParams();
  const [o, setO] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setErr(null);
    api.get(`/observations/${obsId}`).then(res => setO(res.data)).catch(() => setErr("Not found"));
  }, [obsId]);

  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!o) return <Skeleton className="h-64" />;

  return (
    <div data-testid="observation-detail">
      <EntityDetailLayout
        breadcrumbItems={[
          { label: "CIO Command Center", to: "/dashboard" },
          { label: "Observations", to: "/observations" },
          { label: o.control_code || "Observation" },
        ]}
        eyebrow="FINDING"
        title={o.title}
        subtitle={`Due ${fmtDate(o.due_date)} · ${o.control_code || ""}`}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="crt-card p-3"><div className="crt-overline">Severity</div><SeverityBadge value={o.severity} /></div>
        <div className="crt-card p-3"><div className="crt-overline">Status</div><StatusBadge value={o.status} /></div>
        <div className="crt-card p-3"><div className="crt-overline">Financial</div><div className="font-mono">{formatINR(o.financial_impact)}</div></div>
        <div className="crt-card p-3"><div className="crt-overline">Control</div>{o.control_id ? <Link className="text-blue-700 hover:underline font-mono text-[11px]" to={`/controls/${o.control_id}`}>View control</Link> : "—"}</div>
      </div>
      <div className="crt-card p-5 mt-4">
        <SectionHeader eyebrow="DETAIL">Description</SectionHeader>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{o.description}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="crt-card p-5">
          <SectionHeader eyebrow={`${(o.evidences || []).length}`}>Evidence</SectionHeader>
          <ul className="text-xs space-y-1 mt-2">
            {(o.evidences || []).map(e => <li key={e.evidence_id || e.title}>{e.title || e.file_name || "Evidence"}</li>)}
          </ul>
        </div>
        <div className="crt-card p-5">
          <SectionHeader eyebrow={`${(o.remediations || []).length}`}>Remediation</SectionHeader>
          <ul className="text-xs space-y-2 mt-2">
            {(o.remediations || []).map(rm => (
              <li key={rm.remediation_id}><Link to={`/remediation/${rm.remediation_id}`} className="text-blue-700 hover:underline">{rm.closure_status} · {rm.progress}%</Link></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
