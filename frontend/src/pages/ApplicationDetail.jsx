import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/api";
import EntityDetailLayout from "@/components/EntityDetailLayout";
import { SeverityBadge, SectionHeader } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";

export default function ApplicationDetail() {
  const { appId } = useParams();
  const [a, setA] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setErr(null);
    api.get(`/universe/applications/${appId}`).then(res => setA(res.data)).catch(() => setErr("Not found"));
  }, [appId]);

  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!a) return <Skeleton className="h-64" />;

  return (
    <div data-testid="application-detail">
      <EntityDetailLayout
        breadcrumbItems={[
          { label: "Applications dashboard", to: "/dashboard/applications" },
          { label: "Universe", to: "/universe" },
          { label: a.app_name || "Application" },
        ]}
        eyebrow="APPLICATION"
        title={a.app_name}
        subtitle={`${a.hosting_type} · ${a.data_sensitivity}`}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="crt-card p-3"><div className="crt-overline">Criticality</div><SeverityBadge value={a.criticality} /></div>
        <div className="crt-card p-3"><div className="crt-overline">Audit score</div><div className="font-mono font-bold">{a.audit_score?.toFixed(1)}</div></div>
        <div className="crt-card p-3"><div className="crt-overline">Crit CVE</div><div className="font-mono text-red-600">{a.vulnerability_count_critical}</div></div>
        <div className="crt-card p-3"><div className="crt-overline">DR</div>{a.dr_readiness ? "Ready" : "Gap"}</div>
      </div>
      <div className="crt-card p-5 mt-4">
        <SectionHeader eyebrow="TEXT MATCH">Related observations</SectionHeader>
        <ul className="text-xs space-y-1 mt-2">
          {(a.related_observations || []).map(o => (
            <li key={o.observation_id}><Link className="text-blue-700 hover:underline" to={`/observations/${o.observation_id}`}>{o.title}</Link></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
