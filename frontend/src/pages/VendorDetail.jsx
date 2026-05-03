import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/api";
import EntityDetailLayout from "@/components/EntityDetailLayout";
import { SeverityBadge, SectionHeader } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/format";

export default function VendorDetail() {
  const { vendorId } = useParams();
  const [v, setV] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setErr(null);
    api.get(`/universe/vendors/${vendorId}`).then(res => setV(res.data)).catch(() => setErr("Not found"));
  }, [vendorId]);

  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!v) return <Skeleton className="h-64" />;

  return (
    <div data-testid="vendor-detail">
      <EntityDetailLayout
        breadcrumbItems={[
          { label: "Vendor dashboard", to: "/dashboard/vendors" },
          { label: "Universe", to: "/universe" },
          { label: v.vendor_name || "Vendor" },
        ]}
        eyebrow="VENDOR"
        title={v.vendor_name}
        subtitle={v.service_type}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="crt-card p-3"><div className="crt-overline">Criticality</div><SeverityBadge value={v.criticality} /></div>
        <div className="crt-card p-3"><div className="crt-overline">Risk score</div><div className="font-mono font-bold">{v.risk_score?.toFixed(0)}</div></div>
        <div className="crt-card p-3"><div className="crt-overline">Contract end</div><div className="font-mono">{fmtDate(v.contract_end)}</div></div>
        <div className="crt-card p-3"><div className="crt-overline">SOC 2</div><div className="font-mono">{fmtDate(v.soc2_expiry)}</div></div>
      </div>
      <div className="crt-card p-5 mt-4">
        <SectionHeader eyebrow="TITLE MATCH">Related open risks</SectionHeader>
        <ul className="text-xs space-y-1 mt-2">
          {(v.related_risks || []).map(r => (
            <li key={r.risk_id}><Link className="text-blue-700 hover:underline" to={`/risks/${r.risk_id}`}>{r.title}</Link></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
