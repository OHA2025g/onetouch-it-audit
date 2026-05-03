import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/api";
import EntityDetailLayout from "@/components/EntityDetailLayout";
import { SectionHeader } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/format";

export default function CloudAuditResultDetail() {
  const { resultId } = useParams();
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setErr(null);
    api.get(`/dashboard/cloud-audit-result/${resultId}`).then(res => setDoc(res.data)).catch(() => setErr("Not found"));
  }, [resultId]);

  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!doc) return <Skeleton className="h-64" />;

  const rows = [
    ["Public buckets", doc.public_buckets],
    ["Unencrypted resources", doc.unencrypted_resources],
    ["Public IPs", doc.public_ips],
    ["Weak IAM policies", doc.weak_iam_policies],
    ["Unused access keys", doc.unused_access_keys],
    ["Security group misconfigs", doc.security_group_misconfigs],
    ["Zombie resources", doc.zombie_resources],
  ];

  return (
    <div data-testid="cloud-result-detail">
      <EntityDetailLayout
        breadcrumbItems={[
          { label: "Cloud dashboard", to: "/dashboard/cloud" },
          { label: `${doc.cloud_provider} · ${doc.account_id}` },
        ]}
        eyebrow="CLOUD AUDIT"
        title={`${doc.cloud_provider} account`}
        subtitle={`Audit ${doc.audit_date} · Score ${doc.audit_score}`}
      />
      <div className="grid grid-cols-2 gap-3 text-xs mb-4">
        <div className="crt-card p-3"><div className="crt-overline">Monthly spend</div><div className="font-mono font-bold">{formatINR(doc.monthly_spend_inr)}</div></div>
        <div className="crt-card p-3"><div className="crt-overline">Cost leakage</div><div className="font-mono text-red-600">{formatINR(doc.cost_leakage_inr)}</div></div>
      </div>
      <div className="crt-card p-5">
        <SectionHeader eyebrow="FINDINGS">Misconfiguration counts</SectionHeader>
        <table className="w-full text-xs mt-2">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b border-zinc-100 dark:border-zinc-800"><td className="py-1.5">{k}</td><td className="text-right font-mono">{v}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4"><Link className="text-blue-700 hover:underline text-sm" to="/observations?control_code=CLD-001">Observations · public access</Link></div>
      </div>
    </div>
  );
}
