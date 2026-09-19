// 规则判断层：全部为纯函数，不依赖 UI 与存储
import type {
  Batch,
  ComponentItem,
  ComponentStatus,
  GroupStatus,
  TenonType,
  TrialSlot,
} from "./types";

/** 含水率上限：超过 18% 只能送修 */
export const MOISTURE_LIMIT = 18;

/** 各榫型允许间隙（mm） */
export const ALLOWED_GAP: Record<TenonType, number> = {
  燕尾榫: 1.5,
  透榫: 2.0,
  半榫: 1.0,
  箍头榫: 0.8,
};

export const COMPONENT_STATUS_LABEL: Record<ComponentStatus, string> = {
  pending: "待检测",
  eligible: "可试装",
  repair: "送修",
};

export const GROUP_STATUS_LABEL: Record<GroupStatus, string> = {
  queued: "排队中",
  on_slot: "在位待判",
  passed: "试装通过",
  returned: "退回修配",
};

/**
 * 构件状态推导：
 * - 未完成病害复核或含水率检测 → 待检测
 * - 含水率 > 18% 或关键截面缺损 → 只能送修，不得占试装位
 * - 其余 → 可试装
 */
export function componentStatus(c: ComponentItem): ComponentStatus {
  if (!c.diseaseReviewed || c.moisture === null) return "pending";
  if (c.moisture > MOISTURE_LIMIT || c.keySectionDefect) return "repair";
  return "eligible";
}

/** 构件是否允许占用试装位 */
export function canOccupySlot(c: ComponentItem): boolean {
  return componentStatus(c) === "eligible";
}

export function batchKeyOf(building: string, axis: string): string {
  return `${building.trim()}::${axis.trim()}`;
}

/** 构件集合签名：用于识别“同一组构件”，支撑重复试装沿用首次结果 */
export function signatureOf(componentIds: string[]): string {
  return [...componentIds].sort().join("+");
}

/** 编组校验：试装批按建筑和轴线锁定，且每件构件须检测合格 */
export function validateGroup(batch: Batch, members: ComponentItem[]): string | null {
  if (members.length < 2) return "一组试装至少需要 2 件构件";
  for (const m of members) {
    if (m.building !== batch.building || m.axis !== batch.axis) {
      return `构件 ${m.code} 不属于「${batch.building}·${batch.axis}」，试装批已按建筑和轴线锁定`;
    }
    const st = componentStatus(m);
    if (st === "repair") {
      return `构件 ${m.code} 含水率超 18% 或关键截面缺损，只能送修，不得占试装位`;
    }
    if (st === "pending") {
      return `构件 ${m.code} 尚未完成病害复核与含水率检测`;
    }
  }
  return null;
}

/** 一个试装位同时只接纳一组构件 */
export function canPlaceOnSlot(slot: TrialSlot): boolean {
  return slot.groupId === null;
}

export interface GapCheck {
  componentId: string;
  measured: number;
  allowed: number;
  ok: boolean;
}

export interface GapVerdict {
  result: "pass" | "reject";
  checks: GapCheck[];
  overLimit: string[];
}

/** 按榫型允许间隙判定：任一接缝超限即整组退回修配 */
export function judgeGaps(
  members: ComponentItem[],
  measurements: Record<string, number>
): GapVerdict {
  const checks: GapCheck[] = members.map((m) => {
    const allowed = ALLOWED_GAP[m.tenon];
    const measured = measurements[m.id];
    return { componentId: m.id, measured, allowed, ok: measured <= allowed };
  });
  const overLimit = checks.filter((c) => !c.ok).map((c) => c.componentId);
  return { result: overLimit.length === 0 ? "pass" : "reject", checks, overLimit };
}

/** 判定前校验：本轮测量齐全——修配后必须重新测量才能复装 */
export function validateMeasurements(
  members: ComponentItem[],
  measurements: Record<string, number>
): string | null {
  for (const m of members) {
    const v = measurements[m.id];
    if (v === undefined || v === null || Number.isNaN(v)) {
      return `构件 ${m.code} 缺少本轮实测间隙；修配后必须重新测量才能复装`;
    }
    if (v < 0) return `构件 ${m.code} 实测间隙不能为负值`;
  }
  return null;
}

/** 更换构件校验：新件须检测合格、同属本批锁定建筑轴线、榫型与被换件一致 */
export function validateReplacement(
  batch: Batch,
  groupMembers: ComponentItem[],
  outId: string,
  incoming: ComponentItem | undefined
): string | null {
  if (!incoming) return "未找到替换构件";
  if (groupMembers.some((m) => m.id === incoming.id)) return "该构件已在本组内";
  const st = componentStatus(incoming);
  if (st === "repair") return `构件 ${incoming.code} 只能送修，不得入组占位`;
  if (st === "pending") return `构件 ${incoming.code} 尚未完成病害复核与含水率检测`;
  if (incoming.building !== batch.building || incoming.axis !== batch.axis) {
    return "替换构件须同属本试装批锁定的建筑和轴线";
  }
  const out = groupMembers.find((m) => m.id === outId);
  if (!out) return "被换构件不在本组内";
  if (incoming.tenon !== out.tenon) {
    return `替换构件榫型须与被换构件一致（${out.tenon}）`;
  }
  return null;
}
