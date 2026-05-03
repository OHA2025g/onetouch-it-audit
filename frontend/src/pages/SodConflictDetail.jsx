import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/api";
import EntityDetailLayout from "@/components/EntityDetailLayout";
import { SeverityBadge, StatusBadge, SectionHeader } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";

export default function SodConflictDetail() {
  const { conflictId } = useParams();
  const [c, setC] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setErr(null);
    api.get(`/dashboard/iam/sod-conflict/${conflictId}`).then(res => setC(res.data)).catch(() => setErr("Not found"));
  }, [conflictId]);

  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!c) return <Skeleton className="h-64" />;

  return (
    <div data-testid="sod-conflict-detail">
      <EntityDetailLayout
        breadcrumbItems={[
          { label: "Identity dashboard", to: "/dashboard/identity" },
          { label: "SoD conflicts", to: "/dashboard/identity" },
          { label: c.conflict_type || "Conflict" },
        ]}
        eyebrow="SEGREGATION OF DUTIES"
        title={c.conflict_type}
        subtitle={`${c.system} · ${c.user_email}`}
      />
      <div className="crt-card p-5 space-y-3 text-sm">
        <div className="flex gap-2"><SeverityBadge value={c.risk_level} /><StatusBadge value={c.status} /></div>
        <div><span className="crt-overline">Roles</span><div className="font-mono text-xs mt-1">{c.role_1} + {c.role_2}</div></div>
        <SectionHeader eyebrow="REMEDIATION">Suggested follow-up</SectionHeader>
        <Link to="/observations?control_code=IAM-005" className="text-blue-700 hover:underline">Open SoD-related observations</Link>
      </div>
    </div>
  );
}
