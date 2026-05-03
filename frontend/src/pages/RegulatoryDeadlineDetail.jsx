import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/api";
import EntityDetailLayout from "@/components/EntityDetailLayout";
import { StatusBadge } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/format";

export default function RegulatoryDeadlineDetail() {
  const { deadlineId } = useParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setErr(null);
    api.get(`/dashboard/regulatory-deadline/${deadlineId}`).then(res => setD(res.data)).catch(() => setErr("Not found"));
  }, [deadlineId]);

  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!d) return <Skeleton className="h-64" />;

  return (
    <div data-testid="deadline-detail">
      <EntityDetailLayout
        breadcrumbItems={[
          { label: "Compliance", to: "/dashboard/compliance" },
          { label: "Deadlines", to: "/dashboard/compliance" },
          { label: d.event_name?.slice(0, 60) || "Deadline" },
        ]}
        eyebrow="REGULATORY"
        title={d.event_name}
        subtitle={`${d.framework} · Due ${fmtDate(d.due_date)}`}
      />
      <div className="crt-card p-5 text-sm space-y-2">
        <div><StatusBadge value={d.status} /> <span className="text-zinc-500 ml-2">{d.days_remaining < 0 ? `${Math.abs(d.days_remaining)}d overdue` : `${d.days_remaining}d remaining`}</span></div>
        <p className="text-zinc-600 dark:text-zinc-400">{d.description}</p>
        <Link to={`/controls?framework=${encodeURIComponent(d.framework)}`} className="text-blue-700 hover:underline text-sm">View controls for {d.framework}</Link>
      </div>
    </div>
  );
}
