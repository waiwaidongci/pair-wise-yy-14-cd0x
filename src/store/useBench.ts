/**
 * 状态存储层（React 桥接）：持有唯一状态源，所有变更经由规则层判定后落库。
 * 界面只调用这里的动作，不直接改状态；每次变更自动持久化，刷新后一致恢复。
 */

import { useEffect, useState } from "react";
import {
  admitCheck,
  applyOutcome,
  archiveActiveTrials,
  batchOf,
  componentsOf,
  evaluateChecks,
  groupFingerprint,
  judgeGap,
} from "../domain/rules";
import type {
  AssemblyGroup,
  BenchState,
  ComponentItem,
  TenonType,
  TrialRecord,
} from "../domain/types";
import { clearState, loadState, saveState, seedState } from "./storage";

export interface Notice {
  text: string;
  at: number;
}

export interface JudgeOutcome {
  reused: boolean;
  record: TrialRecord;
}

export function useBenchStore() {
  const [state, setState] = useState<BenchState>(loadState);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const say = (text: string) => setNotice({ text, at: Date.now() });
  const nextId = (prefix: string, seq: number) => `${prefix}${seq}`;

  /* ---------- 试装批：按建筑 + 轴线锁定 ---------- */

  const createBatch = (input: { building: string; axis: string; slotCount: number }) => {
    const building = input.building.trim();
    const axis = input.axis.trim();
    if (!building || !axis) return say("请填写建筑名称与轴线");
    if (input.slotCount < 1 || input.slotCount > 4) return say("试装位数量限 1–4 个");
    const dup = state.batches.some((b) => b.building === building && b.axis === axis);
    if (dup) return say(`「${building} · ${axis}」已存在试装批，批次按建筑与轴线锁定`);

    const seq = state.seq;
    const batch = { id: nextId("b", seq), building, axis, slotCount: input.slotCount, createdAt: Date.now() };
    const slots = Array.from({ length: input.slotCount }, (_, i) => ({
      id: nextId("s", seq + 1 + i),
      batchId: batch.id,
      index: i + 1,
      groupId: null,
    }));
    setState({ ...state, seq: seq + 1 + input.slotCount, batches: [...state.batches, batch], slots: [...state.slots, ...slots] });
    say(`试装批已建立并锁定：${building} · ${axis}（${input.slotCount} 个试装位）`);
  };

  /* ---------- 构件登记与双检 ---------- */

  const registerComponent = (input: {
    code: string; building: string; axis: string; wood: string;
    tenonType: TenonType; section: string;
  }) => {
    const code = input.code.trim();
    if (!code || !input.building.trim() || !input.axis.trim()) return say("请填写构件编号、建筑与轴线");
    if (state.components.some((c) => c.code === code)) return say(`构件编号「${code}」已存在`);

    const item: ComponentItem = {
      id: nextId("c", state.seq),
      code,
      building: input.building.trim(),
      axis: input.axis.trim(),
      wood: input.wood.trim() || "未注明",
      tenonType: input.tenonType,
      section: input.section.trim() || "未量测",
      disease: { reviewed: false, criticalDefect: false, note: "" },
      moisture: { measured: false, value: null },
      status: "registered",
      remeasureVersion: 0,
      remeasureNote: "",
      createdAt: Date.now(),
    };
    setState({ ...state, seq: state.seq + 1, components: [...state.components, item] });
    say(`构件「${code}」已登记，待病害复核与含水率检测`);
  };

  /** 双检完成后按规则重定走向（送修 / 可试装） */
  const reroute = (c: ComponentItem): ComponentItem => {
    const verdict = evaluateChecks(c);
    if (!verdict.complete || !verdict.route) return c;
    return { ...c, status: verdict.route };
  };

  const reviewDisease = (id: string, criticalDefect: boolean, note: string) => {
    const target = state.components.find((c) => c.id === id);
    if (!target || target.disease.reviewed) return;
    const components = state.components.map((c) =>
      c.id === id ? reroute({ ...c, disease: { reviewed: true, criticalDefect, note: note.trim() } }) : c
    );
    setState({ ...state, components });
    const after = components.find((c) => c.id === id)!;
    say(
      after.status === "repair"
        ? `「${target.code}」病害复核完成：关键截面缺损，只能送修`
        : `「${target.code}」病害复核完成`
    );
  };

  const measureMoisture = (id: string, value: number) => {
    const target = state.components.find((c) => c.id === id);
    if (!target || target.moisture.measured) return;
    if (!Number.isFinite(value) || value < 0 || value > 60) return say("含水率数值无效（0–60%）");
    const components = state.components.map((c) =>
      c.id === id ? reroute({ ...c, moisture: { measured: true, value } }) : c
    );
    setState({ ...state, components });
    const after = components.find((c) => c.id === id)!;
    say(
      after.status === "repair"
        ? `「${target.code}」含水率 ${value}% 超限，只能送修，不得占试装位`
        : after.status === "eligible"
          ? `「${target.code}」双检合格，可占试装位`
          : `「${target.code}」含水率已记录`
    );
  };

  /* ---------- 修配与复测 ---------- */

  const completeAdjustment = (id: string) => {
    const target = state.components.find((c) => c.id === id);
    if (!target || target.status !== "adjusting") return;
    setState({
      ...state,
      components: state.components.map((c) =>
        c.id === id ? { ...c, status: "remeasure" as const } : c
      ),
    });
    say(`「${target.code}」修配完成，必须重新测量后才能复装`);
  };

  const remeasureComponent = (id: string, note: string) => {
    const target = state.components.find((c) => c.id === id);
    if (!target || target.status !== "remeasure") return;
    if (!note.trim()) return say("请填写复测记录（如修配后截面尺寸）");
    setState({
      ...state,
      components: state.components.map((c) =>
        c.id === id
          ? {
              ...c,
              status: "eligible" as const,
              remeasureVersion: c.remeasureVersion + 1,
              remeasureNote: note.trim(),
            }
          : c
      ),
    });
    say(`「${target.code}」复测登记完成，可重新入位复装`);
  };

  /* ---------- 构件组与队列 ---------- */

  const createGroup = (input: { batchId: string; name: string; tenonType: TenonType; memberIds: string[] }) => {
    const batch = batchOf(state, input.batchId);
    if (!batch) return say("请选择试装批");
    const name = input.name.trim();
    if (!name) return say("请填写组名称");
    if (input.memberIds.length < 2) return say("一组至少选择 2 件构件");

    const members = componentsOf(state, input.memberIds);
    for (const m of members) {
      if (m.building !== batch.building || m.axis !== batch.axis) {
        return say(`「${m.code}」不属于 ${batch.building} · ${batch.axis}，批次已锁定`);
      }
      const admit = admitCheck(m);
      if (!admit.ok) return say(`「${m.code}」${admit.reason}，不能编组`);
    }

    const group: AssemblyGroup = {
      id: nextId("g", state.seq),
      name,
      batchId: batch.id,
      tenonType: input.tenonType,
      memberIds: members.map((m) => m.id),
      status: "queued",
      slotId: null,
      createdAt: Date.now(),
    };
    setState({ ...state, seq: state.seq + 1, groups: [...state.groups, group] });
    say(`构件组「${name}」已编入 ${batch.building} · ${batch.axis} 队列`);
  };

  /** 入位：一个试装位同时只接纳一组，全员须通过占位检查 */
  const admitGroup = (groupId: string) => {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group || group.status === "inSlot") return;
    const slot = state.slots.find((s) => s.batchId === group.batchId && s.groupId === null);
    if (!slot) return say("该试装批暂无空闲试装位，组已留在队列中");

    const members = componentsOf(state, group.memberIds);
    for (const m of members) {
      const admit = admitCheck(m);
      if (!admit.ok) return say(`「${m.code}」${admit.reason}，整组不得入位`);
    }

    setState({
      ...state,
      slots: state.slots.map((s) => (s.id === slot.id ? { ...s, groupId: group.id } : s)),
      groups: state.groups.map((g) =>
        g.id === group.id ? { ...g, status: "inSlot" as const, slotId: slot.id } : g
      ),
    });
    say(`「${group.name}」已入 ${slot.index} 号试装位，等待放线测量`);
  };

  /**
   * 判定：按榫型允许间隙；重复试装（指纹一致）沿用首次结果，不产生新记录。
   * 返回判定结果供界面提示。
   */
  const judgeGroup = (groupId: string, gapMm: number): JudgeOutcome | null => {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group || group.status !== "inSlot" || !group.slotId) return null;
    if (!Number.isFinite(gapMm) || gapMm < 0) {
      say("实测间隙数值无效");
      return null;
    }

    const members = componentsOf(state, group.memberIds);
    const fingerprint = groupFingerprint(group.batchId, members);
    const existing = state.trials.find((t) => t.fingerprint === fingerprint && t.state === "active");

    if (existing) {
      // 规则 6：重复试装沿用首次结果
      const next = applyOutcome(state, group, existing.result);
      setState(next);
      say(
        `「${group.name}」重复试装，沿用首次结果：${existing.result === "pass" ? "通过" : "超限退回"}（不产生新记录）`
      );
      return { reused: true, record: existing };
    }

    const verdict = judgeGap(group.tenonType, gapMm);
    const record: TrialRecord = {
      id: nextId("t", state.seq),
      groupId: group.id,
      groupName: group.name,
      batchId: group.batchId,
      slotId: group.slotId,
      fingerprint,
      members: members.map((m) => ({ componentId: m.id, code: m.code })),
      tenonType: group.tenonType,
      measuredGap: gapMm,
      allowance: verdict.allowance,
      result: verdict.pass ? "pass" : "fail",
      state: "active",
      archiveReason: null,
      createdAt: Date.now(),
      archivedAt: null,
    };
    const next = applyOutcome({ ...state, seq: state.seq + 1, trials: [...state.trials, record] }, group, record.result);
    setState(next);
    say(
      verdict.pass
        ? `「${group.name}」间隙 ${gapMm}mm ≤ ${verdict.allowance}mm，试装通过`
        : `「${group.name}」间隙 ${gapMm}mm 超 ${verdict.allowance}mm，退回修配，复测后方可复装`
    );
    return { reused: false, record };
  };

  /** 规则 5：更换任一构件 → 整组结论立即失效，旧记录留档，按新件重判 */
  const replaceMember = (groupId: string, oldId: string, newId: string) => {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return;
    if (group.status === "inSlot") return say("组正在试装位上，先完成判定再更换构件");
    const batch = batchOf(state, group.batchId);
    const incoming = state.components.find((c) => c.id === newId);
    if (!batch || !incoming) return;
    if (group.memberIds.includes(newId)) return say("该构件已在组内");
    if (incoming.building !== batch.building || incoming.axis !== batch.axis) {
      return say(`「${incoming.code}」不属于 ${batch.building} · ${batch.axis}，批次已锁定`);
    }
    const admit = admitCheck(incoming);
    if (!admit.ok) return say(`「${incoming.code}」${admit.reason}，不能入组`);

    const hadConclusion = state.trials.some((t) => t.groupId === groupId && t.state === "active");
    const trials = archiveActiveTrials(state, groupId, "构件更换，整组结论失效留档", Date.now());
    const groups = state.groups.map((g) =>
      g.id === groupId
        ? { ...g, memberIds: g.memberIds.map((id) => (id === oldId ? newId : id)), status: "queued" as const, slotId: null }
        : g
    );
    setState({ ...state, trials, groups });
    say(
      hadConclusion
        ? `「${group.name}」构件已更换，整组结论立即失效并留档，按新件重判`
        : `「${group.name}」构件已更换，重新排队待试装`
    );
  };

  const resetAll = () => {
    clearState();
    const fresh = seedState();
    setState(fresh);
    saveState(fresh);
    say("已复位为演示数据");
  };

  return {
    state,
    notice,
    createBatch,
    registerComponent,
    reviewDisease,
    measureMoisture,
    completeAdjustment,
    remeasureComponent,
    createGroup,
    admitGroup,
    judgeGroup,
    replaceMember,
    resetAll,
  };
}

export type BenchApi = ReturnType<typeof useBenchStore>;
