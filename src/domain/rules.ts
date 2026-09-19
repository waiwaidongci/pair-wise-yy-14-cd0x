/**
 * 规则判断层：全部领域规则均为纯函数，不依赖界面与存储。
 *
 * 规则清单：
 * 1. 构件须先完成病害复核与含水率检测，双检完成才定走向。
 * 2. 含水率 > 18% 或关键截面缺损 → 只能送修，不得占试装位。
 * 3. 一个试装位同时只接纳一组构件，按榫型允许间隙判定。
 * 4. 超限退回修配；修配后必须重新测量（复测）才能复装。
 * 5. 试装通过后更换任一构件 → 整组结论立即失效，旧记录留档，按新件重判。
 * 6. 重复试装（批 + 构件集合 + 测量版本一致）沿用首次结果，不产生新记录。
 */

import { MOISTURE_LIMIT_PCT, TENON_ALLOWANCE_MM } from "./types";
import type {
  AssemblyGroup,
  BenchState,
  ComponentItem,
  TenonType,
  TrialRecord,
} from "./types";

export interface CheckVerdict {
  /** 病害复核与含水率检测是否都已完成 */
  complete: boolean;
  /** 双检完成后的走向：送修 / 可试装 */
  route: "repair" | "eligible" | null;
  /** 送修原因（可多条） */
  reasons: string[];
}

/** 规则 1 + 2：双检完成后判定走向 */
export function evaluateChecks(c: ComponentItem): CheckVerdict {
  const complete = c.disease.reviewed && c.moisture.measured;
  if (!complete) return { complete, route: null, reasons: [] };

  const reasons: string[] = [];
  if (c.disease.criticalDefect) reasons.push("关键截面缺损");
  if (c.moisture.value !== null && c.moisture.value > MOISTURE_LIMIT_PCT) {
    reasons.push(`含水率 ${c.moisture.value}% 超 ${MOISTURE_LIMIT_PCT}% 上限`);
  }
  return { complete, route: reasons.length > 0 ? "repair" : "eligible", reasons };
}

export interface AdmitVerdict {
  ok: boolean;
  reason: string | null;
}

/** 规则 2 + 4：构件是否允许占试装位 */
export function admitCheck(c: ComponentItem): AdmitVerdict {
  if (!c.disease.reviewed) return { ok: false, reason: "病害复核未完成" };
  if (!c.moisture.measured) return { ok: false, reason: "含水率未检测" };
  switch (c.status) {
    case "repair":
      return { ok: false, reason: "送修构件不得占试装位" };
    case "adjusting":
      return { ok: false, reason: "试装超限退回，修配中" };
    case "remeasure":
      return { ok: false, reason: "修配后须重新测量方可复装" };
    case "eligible":
      return { ok: true, reason: null };
    default:
      return { ok: false, reason: "检测未完成" };
  }
}

export interface GapVerdict {
  allowance: number;
  pass: boolean;
}

/** 规则 3：按榫型允许间隙判定 */
export function judgeGap(tenon: TenonType, gapMm: number): GapVerdict {
  const allowance = TENON_ALLOWANCE_MM[tenon];
  return { allowance, pass: gapMm <= allowance };
}

/**
 * 规则 6：组指纹 = 试装批 + 构件集合 + 各构件测量版本。
 * 指纹一致即重复试装，沿用首次结果；修配复测或换件后指纹改变，重新判定。
 */
export function groupFingerprint(batchId: string, members: ComponentItem[]): string {
  const key = members
    .map((m) => `${m.id}#v${m.remeasureVersion}`)
    .sort()
    .join("+");
  return `${batchId}|${key}`;
}

/** 规则 3：试装判定结论落地（通过 / 超限退回修配），返回新状态 */
export function applyOutcome(
  state: BenchState,
  group: AssemblyGroup,
  result: "pass" | "fail"
): BenchState {
  const slots = state.slots.map((s) =>
    s.groupId === group.id ? { ...s, groupId: null } : s
  );
  const groups = state.groups.map((g) =>
    g.id === group.id
      ? { ...g, status: result === "pass" ? ("passed" as const) : ("returned" as const), slotId: null }
      : g
  );
  // 超限 → 整组构件退回修配
  const components =
    result === "fail"
      ? state.components.map((c) =>
          group.memberIds.includes(c.id) ? { ...c, status: "adjusting" as const } : c
        )
      : state.components;
  return { ...state, slots, groups, components };
}

/** 规则 5：更换构件 → 该组有效结论立即失效留档 */
export function archiveActiveTrials(
  state: BenchState,
  groupId: string,
  reason: string,
  at: number
): TrialRecord[] {
  return state.trials.map((t) =>
    t.groupId === groupId && t.state === "active"
      ? { ...t, state: "archived" as const, archiveReason: reason, archivedAt: at }
      : t
  );
}

/* ---------- 查询类纯函数（供界面与存储层共用） ---------- */

export function batchOf(state: BenchState, batchId: string) {
  return state.batches.find((b) => b.id === batchId);
}

export function componentsOf(state: BenchState, ids: string[]): ComponentItem[] {
  return ids
    .map((id) => state.components.find((c) => c.id === id))
    .filter((c): c is ComponentItem => Boolean(c));
}

/** 组当前有效试装记录（每组至多一条） */
export function activeTrialOf(state: BenchState, groupId: string): TrialRecord | undefined {
  return state.trials.find((t) => t.groupId === groupId && t.state === "active");
}

/** 组是否存在留档记录（曾因换件失效） */
export function hasArchivedTrial(state: BenchState, groupId: string): boolean {
  return state.trials.some((t) => t.groupId === groupId && t.state === "archived");
}

export type VerdictTone = "ok" | "bad" | "warn" | "info" | "muted";

/** 组结论的展示口径：界面（队列 / 关系视图）统一从这里取，保证一致 */
export function groupVerdict(
  state: BenchState,
  group: AssemblyGroup
): { label: string; tone: VerdictTone } {
  const active = activeTrialOf(state, group.id);
  if (active) {
    return active.result === "pass"
      ? { label: `试装通过（${active.measuredGap}mm ≤ ${active.allowance}mm）`, tone: "ok" }
      : { label: `超限退回（${active.measuredGap}mm > ${active.allowance}mm）`, tone: "bad" };
  }
  if (group.status === "inSlot") return { label: "试装中", tone: "info" };
  if (hasArchivedTrial(state, group.id)) {
    return { label: "结论已失效 · 按新件重判", tone: "warn" };
  }
  if (group.status === "returned") return { label: "退回修配 · 待复装", tone: "warn" };
  return { label: "排队待试装", tone: "muted" };
}
