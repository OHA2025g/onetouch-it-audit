/**
 * Back-compat wrapper around the generic InsightsSection for the CIO scope.
 * Keeps the `data-testid="cio-insights-section"` contract that existing tests rely on.
 */
import React from "react";
import InsightsSection from "@/components/InsightsSection";

export default function CIOInsightsSection() {
  return (
    <InsightsSection
      scope="cio"
      eyebrow="CIO COCKPIT"
      title="CIO AI Insights"
      testId="cio-insights-section"
    />
  );
}
