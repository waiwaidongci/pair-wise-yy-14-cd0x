/**
 * 界面共享小组件与展示常量。
 */

import type { ReactNode } from "react";
import type { VerdictTone } from "../domain/rules";
import type { ComponentStatus } from "../domain/types";

export const COMPONENT_STATUS_META: Record<ComponentStatus, { label: string; tone: VerdictTone }> = {
  registered: { label: "待检测", tone: "muted" },
  eligible: { label: "可试装", tone: "ok" },
  repair: { label: "送修", tone: "bad" },
  adjusting: { label: "修配中", tone: "warn" },
  remeasure: { label: "待复测", tone: "info" },
};

export function Badge({ tone, children }: { tone: VerdictTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SectionHead({
  kicker,
  title,
  extra,
}: {
  kicker: string;
  title: string;
  extra?: ReactNode;
}) {
  return (
    <div className="heading">
      <div>
        <p>{kicker}</p>
        <h2>{title}</h2>
      </div>
      {extra}
    </div>
  );
}
