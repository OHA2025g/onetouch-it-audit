import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/api";
import { PageHeader, SectionHeader, SeverityBadge } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import InsightsSection from "@/components/InsightsSection";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

export default function ControlLibrary() {
  const [searchParams] = useSearchParams();
  const [controls, setControls] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [fw, setFw] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const f = searchParams.get("framework");
    const code = searchParams.get("control_code");
    if (f) setFw(f);
    if (code) setQ(code);
  }, [searchParams]);

  useEffect(() => {
    const params = {};
    if (cat !== "all") params.category = cat;
    if (fw !== "all") params.framework = fw;
    const code = searchParams.get("control_code");
    if (code) params.control_code = code;
    setLoading(true);
    api.get("/controls", { params }).then(r => setControls(r.data)).finally(() => setLoading(false));
  }, [cat, fw, searchParams]);

  const filtered = controls.filter(c =>
    !q || c.control_name?.toLowerCase().includes(q.toLowerCase()) ||
    c.control_code?.toLowerCase().includes(q.toLowerCase()) ||
    c.description?.toLowerCase().includes(q.toLowerCase())
  );

  const cats = ["Access_Management","Change_Management","Backup","Incident_Management","Cloud_Security","Vulnerability","Data_Privacy","Application_Security","Network_Security","Endpoint_Security","DevSecOps","BCP_DR"];
  const fws = ["ISO27001","SOC2","DPDP","RBI_IT","SEBI_Cyber","CERT_In","ITGC","IFC"];

  return (
    <div className="space-y-6" data-testid="control-library">
      <PageHeader eyebrow={`${controls.length} CONTROLS`} title="Control Library" subtitle="Master catalog mapped across 8 frameworks" />
      <InsightsSection scope="controls" eyebrow="CONTROLS · COCKPIT" title="Control AI Insights" />
      <div className="crt-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 h-9 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-zinc-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by code, name, description..." className="bg-transparent outline-none text-sm flex-1" data-testid="control-search-input" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="rounded-sm w-48" data-testid="control-category-filter"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {cats.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fw} onValueChange={setFw}>
          <SelectTrigger className="rounded-sm w-40" data-testid="control-framework-filter"><SelectValue placeholder="Framework" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Frameworks</SelectItem>
            {fws.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {loading && <Skeleton className="h-96" />}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(c => (
          <Link key={c.control_id} to={`/controls/${c.control_id}`} className="crt-card p-4 hover:border-blue-300 dark:hover:border-blue-800 block text-inherit" data-testid={`control-card-${c.control_id}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-mono font-bold text-blue-700 dark:text-blue-400">{c.control_code}</span>
              <SeverityBadge value={c.severity} />
            </div>
            <div className="font-display font-bold text-sm tracking-tight mb-1">{c.control_name}</div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-3 line-clamp-2">{c.description}</div>
            <div className="flex items-center justify-between text-[10px] text-zinc-400">
              <span>{c.frequency} · {c.testing_method}</span>
              <span className="font-mono">{c.category?.replace(/_/g," ")}</span>
            </div>
            {c.frameworks?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                {c.frameworks.slice(0, 5).map((f, i) => (
                  <span key={i} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-sm">{f.framework}</span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
