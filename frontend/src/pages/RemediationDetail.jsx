import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/api";
import EntityDetailLayout from "@/components/EntityDetailLayout";
import { StatusBadge } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";

export default function RemediationDetail() {
  const { remediationId } = useParams();
  const [r, setR] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setErr(null);
    api.get(`/remediation/${remediationId}`).then(res => setR(res.data)).catch(() => setErr("Not found"));
  }, [remediationId]);

  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!r) return <Skeleton className="h-64" />;

  return (
    <div data-testid="remediation-detail">
      <EntityDetailLayout
        breadcrumbItems={[
          { label: "Remediation", to: "/remediation" },
          { label: r.remediation_id?.slice(0, 12) || "Item" },
        ]}
        eyebrow="REMEDIATION"
        title={`Plan · ${r.closure_status || "Pending"}`}
        subtitle={r.priority ? `Priority ${r.priority}` : ""}
      />
      <div className="crt-card p-5 space-y-3 text-sm">
        <div><span className="crt-overline">Progress</span> {r.progress}%</div>
        <div><span className="crt-overline">SLA</span> <StatusBadge value={r.sla_status} /></div>
        <div><span className="crt-overline">Action plan</span><pre className="mt-1 text-xs whitespace-pre-wrap font-sans text-zinc-600 dark:text-zinc-400">{r.action_plan}</pre></div>
        {r.observation && (
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <Link className="text-blue-700 dark:text-blue-400 hover:underline font-medium" to={`/observations/${r.observation.observation_id}`} data-testid="remediation-to-obs">
              Linked observation: {r.observation.title}
            </Link>
          </div>
        )}
        {r.control && (
          <div>
            <Link className="text-blue-700 dark:text-blue-400 hover:underline text-sm" to={`/controls/${r.control.control_id}`}>Control {r.control.control_code}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
