"use client";

import type { ReactNode } from "react";

type MonitoringPanelShellProps = {
  title: string;
  icon?: ReactNode;
  tone?: "game" | "rehab" | "assessment";
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

export default function MonitoringPanelShell({
  title,
  icon = "🩺",
  tone = "game",
  className = "",
  bodyClassName = "",
  children,
}: MonitoringPanelShellProps) {
  return (
    <div
      className={`vt-glass vt-report-card monitoring-panel-shell monitoring-panel-shell-${tone} ${className}`.trim()}
    >
      <div className="vt-panel-title">
        <span className="vt-panel-icon">{icon}</span>
        <strong>{title}</strong>
      </div>
      <div className={`monitoring-panel-body ${bodyClassName}`.trim()}>{children}</div>
    </div>
  );
}
