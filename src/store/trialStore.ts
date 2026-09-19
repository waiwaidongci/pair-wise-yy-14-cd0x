// 状态存储层：持有全部试装状态，动作内调用规则层，变更即持久化
// 刷新后队列、构件关系视图、判定结论保持一致
import type {
  Batch,
  ComponentItem,
  TenonType,
  TrialGroup,
  TrialRecord,
  TrialSlot,
} from "../domain/types";
import {
  batchKeyOf,
  canPlaceOnSlot,
  judgeGaps,
  signatureOf,
  validateGroup,
  validateMeasurements,
  validateReplacement,
} from "../domain/rules";

const STORAGE_KEY = "mortise-tenon-trial-v1";
const SLOTS_PER_BATCH = 2;

export interface TrialState {
  components: ComponentItem[];
  batches: Batch[];
  groups: TrialGroup[];
  slots: TrialSlot[];
  records: TrialRecord[];
}

export interface ActionResult {
  ok: boolean;
  message: string;
  reused?: boolean;
  record?: TrialRecord;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeSlots(batchKey: string): TrialSlot[] {
  return Array.from({ length: SLOTS_PER_BATCH }, (_, i) => ({
    id: `${batchKey}#slot-${i + 1}`,
    batchKey,
    label: `试装位 ${i + 1}`,
    groupId: null,
  }));
}

/** 初始演示数据：两条轴线试装批，含一组已通过试装 */
function seedState(): TrialState {
  const now = Date.now();
  const b1 = batchKeyOf("慈宁宫东配殿", "③轴");
  const b2 = batchKeyOf("慈宁宫东配殿", "⑤轴");
  const components: ComponentItem[] = [
    { id: "c-a03", code: "梁架A-03", building: "慈宁宫东配殿", axis: "③轴", wood: "榆木", tenon: "透榫", section: "180×240mm", diseaseReviewed: true, keySectionDefect: false, diseaseNote: "端部开裂（非关键截面）", moisture: 12.4 },
    { id: "c-e02", code: "额枋E-02", building: "慈宁宫东配殿", axis: "③轴", wood: "榆木", tenon: "燕尾榫", section: "150×220mm", diseaseReviewed: true, keySectionDefect: false, diseaseNote: "", moisture: 9.8 },
    { id: "c-c12", code: "柱网C-12", building: "慈宁宫东配殿", axis: "③轴", wood: "楠木", tenon: "箍头榫", section: "Φ240mm", diseaseReviewed: true, keySectionDefect: true, diseaseNote: "柱脚糟朽（关键截面）", moisture: 14.2 },
    { id: "c-d07", code: "斗拱D-07", building: "慈宁宫东配殿", axis: "③轴", wood: "松木", tenon: "半榫", section: "120×180mm", diseaseReviewed: true, keySectionDefect: false, diseaseNote: "轻微变形", moisture: 21.6 },
    { id: "c-f05", code: "脊枋F-05", building: "慈宁宫东配殿", axis: "③轴", wood: "杉木", tenon: "半榫", section: "140×200mm", diseaseReviewed: false, keySectionDefect: false, diseaseNote: "", moisture: null },
    { id: "c-b01", code: "梁架B-01", building: "慈宁宫东配殿", axis: "⑤轴", wood: "杉木", tenon: "透榫", section: "160×240mm", diseaseReviewed: true, keySectionDefect: false, diseaseNote: "", moisture: 11.5 },
    { id: "c-b02", code: "随梁B-02", building: "慈宁宫东配殿", axis: "⑤轴", wood: "杉木", tenon: "燕尾榫", section: "120×200mm", diseaseReviewed: true, keySectionDefect: false, diseaseNote: "", moisture: 10.2 },
    { id: "c-g09", code: "檩条G-09", building: "慈宁宫东配殿", axis: "⑤轴", wood: "松木", tenon: "箍头榫", section: "Φ180mm", diseaseReviewed: false, keySectionDefect: false, diseaseNote: "", moisture: null },
  ];
  const batches: Batch[] = [
    { key: b1, building: "慈宁宫东配殿", axis: "③轴", createdAt: now - 7200_000 },
    { key: b2, building: "慈宁宫东配殿", axis: "⑤轴", createdAt: now - 7000_000 },
  ];
  const groups: TrialGroup[] = [
    { id: "g-b1", name: "⑤轴·G1", batchKey: b2, componentIds: ["c-b01", "c-b02"], status: "passed", round: 1, enqueuedAt: now - 3600_000, slotId: null },
  ];
  const records: TrialRecord[] = [
    {
      id: "r-b1-1",
      groupId: "g-b1",
      groupName: "⑤轴·G1",
      batchKey: b2,
      componentIds: ["c-b01", "c-b02"],
      signature: signatureOf(["c-b01", "c-b02"]),
      round: 1,
      measurements: { "c-b01": 1.2, "c-b02": 0.9 },
      result: "pass",
      overLimit: [],
      createdAt: now - 3500_000,
      archived: false,
    },
  ];
  return {
    components,
    batches,
    groups,
    slots: [...makeSlots(b1), ...makeSlots(b2)],
    records,
  };
}

function loadState(): TrialState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TrialState;
      if (parsed && Array.isArray(parsed.components) && Array.isArray(parsed.groups)) {
        return parsed;
      }
    }
  } catch {
    // 存储不可用时退回初始数据
  }
  return seedState();
}

function persist(state: TrialState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 忽略写入失败（如隐私模式）
  }
}

class TrialStore {
  private state: TrialState;
  private listeners = new Set<() => void>();

  constructor() {
    this.state = loadState();
  }

  getState = (): TrialState => this.state;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private set(next: TrialState): void {
    this.state = next;
    persist(next);
    this.listeners.forEach((l) => l());
  }

  private membersOf(group: TrialGroup): ComponentItem[] {
    return group.componentIds
      .map((id) => this.state.components.find((c) => c.id === id))
      .filter((c): c is ComponentItem => Boolean(c));
  }

  /** 登记构件（登记后为待检测状态） */
  registerComponent(input: {
    code: string;
    building: string;
    axis: string;
    wood: string;
    tenon: TenonType;
    section: string;
  }): ActionResult {
    const code = input.code.trim();
    const building = input.building.trim();
    const axis = input.axis.trim();
    if (!code || !building || !axis) return { ok: false, message: "建筑名称、轴线、构件编号均须填写" };
    if (this.state.components.some((c) => c.code === code && c.building === building && c.axis === axis)) {
      return { ok: false, message: `构件 ${code} 在「${building}·${axis}」已登记` };
    }
    const item: ComponentItem = {
      id: uid("c"),
      code,
      building,
      axis,
      wood: input.wood.trim() || "未注明",
      tenon: input.tenon,
      section: input.section.trim() || "未测",
      diseaseReviewed: false,
      keySectionDefect: false,
      diseaseNote: "",
      moisture: null,
    };
    this.set({ ...this.state, components: [...this.state.components, item] });
    return { ok: true, message: `构件 ${code} 已登记，待病害复核与含水率检测` };
  }

  /** 录入病害复核与含水率检测结果 */
  recordInspection(
    id: string,
    patch: { diseaseReviewed: boolean; keySectionDefect: boolean; moisture: number | null; diseaseNote: string }
  ): ActionResult {
    const target = this.state.components.find((c) => c.id === id);
    if (!target) return { ok: false, message: "未找到构件" };
    if (!patch.diseaseReviewed) return { ok: false, message: "须先完成病害复核" };
    if (patch.moisture === null || Number.isNaN(patch.moisture)) {
      return { ok: false, message: "须填写含水率检测值" };
    }
    if (patch.moisture < 0 || patch.moisture > 60) {
      return { ok: false, message: "含水率数值超出合理范围（0–60%）" };
    }
    const next = this.state.components.map((c) => (c.id === id ? { ...c, ...patch } : c));
    this.set({ ...this.state, components: next });
    const updated = next.find((c) => c.id === id)!;
    const verdict =
      patch.moisture > 18 || patch.keySectionDefect
        ? "判定：只能送修，不得占试装位"
        : "判定：可入试装位";
    return { ok: true, message: `构件 ${updated.code} 检测已录入，${verdict}` };
  }

  /** 开立试装批（按建筑+轴线锁定，重复开立幂等） */
  openBatch(building: string, axis: string): ActionResult {
    const key = batchKeyOf(building, axis);
    if (!building.trim() || !axis.trim()) return { ok: false, message: "建筑名称与轴线均须填写" };
    if (this.state.batches.some((b) => b.key === key)) {
      return { ok: true, reused: true, message: `试装批「${building.trim()}·${axis.trim()}」已存在，按建筑和轴线锁定` };
    }
    const batch: Batch = { key, building: building.trim(), axis: axis.trim(), createdAt: Date.now() };
    this.set({
      ...this.state,
      batches: [...this.state.batches, batch],
      slots: [...this.state.slots, ...makeSlots(key)],
    });
    return { ok: true, message: `试装批「${batch.building}·${batch.axis}」已开立，配 ${SLOTS_PER_BATCH} 个试装位` };
  }

  /** 编组入列：同批同构件组合重复提交时沿用既有组（重复试装沿用首次结果） */
  formGroup(batchKey: string, componentIds: string[]): ActionResult {
    const batch = this.state.batches.find((b) => b.key === batchKey);
    if (!batch) return { ok: false, message: "试装批不存在" };
    const members = componentIds
      .map((id) => this.state.components.find((c) => c.id === id))
      .filter((c): c is ComponentItem => Boolean(c));
    const err = validateGroup(batch, members);
    if (err) return { ok: false, message: err };
    const sig = signatureOf(componentIds);
    const dup = this.state.groups.find(
      (g) => g.batchKey === batchKey && signatureOf(g.componentIds) === sig
    );
    if (dup) {
      const hasPass = this.state.records.some(
        (r) => r.groupId === dup.id && !r.archived && r.result === "pass"
      );
      return {
        ok: true,
        reused: true,
        message: hasPass
          ? `相同构件组合已通过试装，沿用首次结果，不再重复占位（${dup.name}）`
          : `相同构件组合已在流程中（${dup.name}），不重复编组`,
      };
    }
    const seq = this.state.groups.filter((g) => g.batchKey === batchKey).length + 1;
    const group: TrialGroup = {
      id: uid("g"),
      name: `${batch.axis}·G${seq}`,
      batchKey,
      componentIds: [...componentIds],
      status: "queued",
      round: 0,
      enqueuedAt: Date.now(),
      slotId: null,
    };
    this.set({ ...this.state, groups: [...this.state.groups, group] });
    return { ok: true, message: `${group.name} 已编组入列（${members.length} 件构件）` };
  }

  /** 上位：队列中的组进入本批第一个空闲试装位；一个试装位同时只接纳一组 */
  placeOnSlot(groupId: string): ActionResult {
    const group = this.state.groups.find((g) => g.id === groupId);
    if (!group) return { ok: false, message: "试装组不存在" };
    if (group.status !== "queued") return { ok: false, message: "仅排队中的组可上位" };
    const slot = this.state.slots.find((s) => s.batchKey === group.batchKey && canPlaceOnSlot(s));
    if (!slot) return { ok: false, message: "本批试装位已全部占用，一组一位" };
    const slots = this.state.slots.map((s) => (s.id === slot.id ? { ...s, groupId: group.id } : s));
    const groups = this.state.groups.map((g) =>
      g.id === group.id ? { ...g, status: "on_slot" as const, slotId: slot.id } : g
    );
    this.set({ ...this.state, slots, groups });
    return { ok: true, message: `${group.name} 已上${slot.label}，请逐件测量接缝间隙后判定` };
  }

  /**
   * 测量判定：
   * - 同组同构件集合已有生效“通过”记录 → 重复试装沿用首次结果，不产生新记录
   * - 否则须本轮测量齐全（修配后必须重新测量才能复装），按榫型允许间隙判定
   * - 超限退回修配，通过则离位
   */
  judgeGroup(groupId: string, measurements: Record<string, number>): ActionResult {
    const group = this.state.groups.find((g) => g.id === groupId);
    if (!group) return { ok: false, message: "试装组不存在" };
    const sig = signatureOf(group.componentIds);
    const existing = this.state.records.find(
      (r) => r.groupId === group.id && !r.archived && r.signature === sig && r.result === "pass"
    );
    if (existing) {
      return { ok: true, reused: true, record: existing, message: `重复试装：沿用首次判定结果（第 ${existing.round} 轮 · 通过）` };
    }
    if (group.status !== "on_slot") return { ok: false, message: "试装组未在试装位上，无法判定" };
    const members = this.membersOf(group);
    const mErr = validateMeasurements(members, measurements);
    if (mErr) return { ok: false, message: mErr };
    const verdict = judgeGaps(members, measurements);
    const record: TrialRecord = {
      id: uid("r"),
      groupId: group.id,
      groupName: group.name,
      batchKey: group.batchKey,
      componentIds: [...group.componentIds],
      signature: sig,
      round: group.round + 1,
      measurements: { ...measurements },
      result: verdict.result,
      overLimit: verdict.overLimit,
      createdAt: Date.now(),
      archived: false,
    };
    const passed = verdict.result === "pass";
    const groups = this.state.groups.map((g) =>
      g.id === group.id
        ? { ...g, status: passed ? ("passed" as const) : ("returned" as const), round: g.round + 1, slotId: null }
        : g
    );
    const slots = this.state.slots.map((s) => (s.groupId === group.id ? { ...s, groupId: null } : s));
    this.set({ ...this.state, groups, slots, records: [...this.state.records, record] });
    if (passed) {
      return { ok: true, record, message: `${group.name} 第 ${record.round} 轮判定：全部接缝在允许间隙内，试装通过` };
    }
    const names = verdict.overLimit
      .map((id) => members.find((m) => m.id === id)?.code ?? id)
      .join("、");
    return { ok: true, record, message: `${group.name} 第 ${record.round} 轮判定：${names} 间隙超限，退回修配；修配后须重新测量方可复装` };
  }

  /** 修配完成，复装入列（须重新排队、重新测量） */
  refitAndRequeue(groupId: string): ActionResult {
    const group = this.state.groups.find((g) => g.id === groupId);
    if (!group) return { ok: false, message: "试装组不存在" };
    if (group.status !== "returned") return { ok: false, message: "仅退回修配的组可复装入列" };
    const groups = this.state.groups.map((g) =>
      g.id === group.id ? { ...g, status: "queued" as const, enqueuedAt: Date.now() } : g
    );
    this.set({ ...this.state, groups });
    return { ok: true, message: `${group.name} 修配完成已重新排队；复装须重新测量全部接缝` };
  }

  /**
   * 更换构件：试装通过后更换任一构件，整组结论立即失效；
   * 旧记录留档（archived），按新构件重新排队重判
   */
  replaceComponent(groupId: string, outId: string, inId: string): ActionResult {
    const group = this.state.groups.find((g) => g.id === groupId);
    if (!group) return { ok: false, message: "试装组不存在" };
    if (group.status !== "passed") return { ok: false, message: "仅试装通过的组涉及结论失效，可执行更换" };
    const batch = this.state.batches.find((b) => b.key === group.batchKey);
    if (!batch) return { ok: false, message: "试装批不存在" };
    const incoming = this.state.components.find((c) => c.id === inId);
    const err = validateReplacement(batch, this.membersOf(group), outId, incoming);
    if (err) return { ok: false, message: err };
    const outCode = this.state.components.find((c) => c.id === outId)?.code ?? outId;
    const reason = `更换构件 ${outCode} → ${incoming!.code}，结论失效留档`;
    const records = this.state.records.map((r) =>
      r.groupId === group.id && !r.archived ? { ...r, archived: true, archiveReason: reason } : r
    );
    const groups = this.state.groups.map((g) =>
      g.id === group.id
        ? {
            ...g,
            componentIds: g.componentIds.map((id) => (id === outId ? inId : id)),
            status: "queued" as const,
            enqueuedAt: Date.now(),
            slotId: null,
          }
        : g
    );
    this.set({ ...this.state, groups, records });
    return { ok: true, message: `${group.name} 已更换构件，整组结论立即失效；旧记录留档，按新件重新排队试装` };
  }

  /** 清空并恢复初始演示数据 */
  resetAll(): ActionResult {
    this.set(seedState());
    return { ok: true, message: "已恢复初始演示数据" };
  }
}

export const trialStore = new TrialStore();
