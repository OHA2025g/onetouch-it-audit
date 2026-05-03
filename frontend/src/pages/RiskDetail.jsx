import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/api";
import EntityDetailLayout from "@/components/EntityDetailLayout";
import { SeverityBadge, StatusBadge, SectionHeader } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/format";

export default function RiskDetail() {
  const { riskId } = useParams();
  const [r, setR] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setErr(null);
    api.get(`/risks/${riskId}`).then(res => setR(res.data)).catch(() => setErr("Not found"));
  }, [riskId]);

  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!r) return <Skeleton className="h-64" />;

  return (
    <div data-testid="risk-detail">
      <EntityDetailLayout
        breadcrumbItems={[
          { label: "CIO Command Center", to: "/dashboard" },
          { label: "Risks", to: "/risks" },
          { label: r.title?.slice(0, 80) || "Risk" },
        ]}
        eyebrow="RISK REGISTER"
        title={r.title}
        subtitle={r.related_observations_note}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="crt-card p-3"><div className="crt-overline">Severity</div><SeverityBadge value={r.severity} /></div>
        <div className="crt-card p-3"><div className="crt-overline">Status</div><StatusBadge value={r.status} /></div>
        <div className="crt-card p-3"><div className="crt-overline">Score</div><div className="font-mono font-bold">{r.risk_score?.toFixed(1)}</div></div>
        <div className="crt-card p-3"><div className="crt-overline">Exposure</div><div className="font-mono">{formatINR(r.financial_impact)}</div></div>
      </div>
      <div className="crt-card p-5 mt-4">
        <SectionHeader eyebrow="CONTEXT">Description</SectionHeader>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{r.description}</p>
      </div>
      <div className="crt-card p-5 mt-4">
        <SectionHeader eyebrow="INFERRED LINKAGE">Related observations</SectionHeader>
        <table className="w-full text-xs crt-table mt-2">
          <thead className="text-zinc-500 border-b"><tr><th className="text-left py-2">Title</th><th className="text-left">Code</th><th className="text-left">Severity</th></tr></thead>
          <tbody>
            {(r.related_observations || []).map(o => (
              <tr key={o.observation_id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2"><Link className="text-blue-700 dark:text-blue-400 hover:underline font-medium" to={`/observations/${o.observation_id}`} data-testid={`rel-obs-${o.observation_id}`}>{o.title}</Link></td>
                <td className="font-mono">{o.control_code}</td>
                <td><SeverityBadge value={o.severity} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
