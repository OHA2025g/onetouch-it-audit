import React from "react";
import DrillBreadcrumb from "@/components/DrillBreadcrumb";
import { PageHeader } from "@/components/Primitives";

export default function EntityDetailLayout({ breadcrumbItems, eyebrow, title, subtitle, actions, children }) {
  return (
    <div className="space-y-6" data-testid="entity-detail-layout">
      <DrillBreadcrumb items={breadcrumbItems} />
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} actions={actions} />
      {children}
    </div>
  );
}
