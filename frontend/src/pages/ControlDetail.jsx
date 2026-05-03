import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/api";
import EntityDetailLayout from "@/components/EntityDetailLayout";
import { SeverityBadge, SectionHeader } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";

export default function ControlDetail() {
  const { controlId } = useParams();
  const [c, setC] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setErr(null);
    api.get(`/controls/${controlId}`).then(res => setC(res.data)).catch(() => setErr("Not found"));
  }, [controlId]);

  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!c) return <Skeleton className="h-64" />;

  return (
    <div data-testid="control-detail">
      <EntityDetailLayout
        breadcrumbItems={[
          { label: "CIO Command Center", to: "/dashboard" },
          { label: "Control library", to: "/controls" },
          { label: c.control_code || "Control" },
        ]}
        eyebrow="CONTROL"
        title={c.control_name}
        subtitle={c.control_code}
      />
      <div className="crt-card p-5">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{c.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(c.frameworks || []).map((f, i) => (
            <span key={i} className="text-[10px] font-bold uppercase px-2 py-0.5 border rounded-sm">{f.framework}</span>
          ))}
        </div>
      </div>
      <div className="crt-card p-5 mt-4">
        <SectionHeader eyebrow={`${c.observations_open_count || 0} OPEN`}>Observations on this control</SectionHeader>
        <table className="w-full text-xs crt-table mt-2">
          <thead className="text-zinc-500 border-b"><tr><th className="text-left py-2">Title</th><th className="text-left">Severity</th></tr></thead>
          <tbody>
            {(c.observations || []).map(o => (
              <tr key={o.observation_id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2"><Link className="text-blue-700 dark:text-blue-400 hover:underline" to={`/observations/${o.observation_id}`}>{o.title}</Link></td>
                <td><SeverityBadge value={o.severity} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
