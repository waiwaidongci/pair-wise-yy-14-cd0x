// 界面共享小组件
import type { ComponentStatus, GroupStatus } from "../domain/types";
import { COMPONENT_STATUS_LABEL, GROUP_STATUS_LABEL } from "../domain/rules";

export function ComponentBadge({ status }: { status: ComponentStatus }) {
  return <span className={`badge comp-${status}`}>{COMPONENT_STATUS_LABEL[status]}</span>;
}

export function GroupBadge({ status }: { status: GroupStatus }) {
  return <span className={`badge grp-${status}`}>{GROUP_STATUS_LABEL[status]}</span>;
}

export function Msg({ text, kind }: { text: string; kind: "ok" | "err" }) {
  if (!text) return null;
  return <p className={`msg ${kind === "err" ? "msg-err" : "msg-ok"}`}>{text}</p>;
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}
