import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/api";
import EntityDetailLayout from "@/components/EntityDetailLayout";
import { SeverityBadge, SectionHeader } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/format";

export default function UserAccessRiskDetail() {
  const { userRiskId } = useParams();
  const [u, setU] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setErr(null);
    api.get(`/dashboard/iam/user-access-risk/${userRiskId}`).then(res => setU(res.data)).catch(() => setErr("Not found"));
  }, [userRiskId]);

  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!u) return <Skeleton className="h-64" />;

  return (
    <div data-testid="user-access-risk-detail">
      <EntityDetailLayout
        breadcrumbItems={[
          { label: "Identity dashboard", to: "/dashboard/identity" },
          { label: "User access risk", to: "/dashboard/identity" },
          { label: u.user_email || "User" },
        ]}
        eyebrow="IAM"
        title={u.user_email}
        subtitle={`${u.user_department} · Last login ${fmtDate(u.last_login_date)}`}
      />
      <div className="crt-card p-4 mb-4"><SeverityBadge value={u.risk_level} /> <span className="text-xs text-zinc-500 ml-2">User access risk record</span></div>
      <div className="crt-card p-5">
        <SectionHeader eyebrow="ISSUES">Flags</SectionHeader>
        <ul className="text-xs space-y-2 mt-2">
          {(u.issues || []).map((it, i) => (
            <li key={i} className="border-b border-zinc-100 dark:border-zinc-800 pb-2"><span className="font-mono font-bold">{it.type}</span> — {it.description} <SeverityBadge value={it.severity} /></li>
          ))}
        </ul>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-4">{u.recommendation}</p>
        <Link to="/observations?control_code=IAM-002" className="text-blue-700 hover:underline text-sm mt-2 inline-block">Related dormant-account observations</Link>
      </div>
    </div>
  );
}
