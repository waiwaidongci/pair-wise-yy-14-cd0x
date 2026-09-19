/**
 * 状态存储层：localStorage 持久化 + 演示数据种子。
 * 只负责读写与初始数据，不含规则判断；刷新后队列、关系视图、结论均由此恢复。
 */

import { groupFingerprint } from "../domain/rules";
import type { BenchState } from "../domain/types";

const STORAGE_KEY = "mortise-tenon-bench:v1";

export function seedState(): BenchState {
  const now = Date.now();
  const state: BenchState = {
    seq: 100,
    batches: [
      { id: "b1", building: "报恩寺大殿", axis: "A轴", slotCount: 2, createdAt: now - 86000 },
      { id: "b2", building: "藏经阁", axis: "B轴", slotCount: 1, createdAt: now - 80000 },
    ],
    slots: [
      { id: "s1", batchId: "b1", index: 1, groupId: null },
      { id: "s2", batchId: "b1", index: 2, groupId: null },
      { id: "s3", batchId: "b2", index: 1, groupId: null },
    ],
    components: [
      {
        id: "c1", code: "柱 ZA-01", building: "报恩寺大殿", axis: "A轴",
        wood: "楠木", tenonType: "箍头榫", section: "240×240mm",
        disease: { reviewed: true, criticalDefect: false, note: "柱脚轻微糟朽，非关键截面" },
        moisture: { measured: true, value: 12.6 },
        status: "eligible", remeasureVersion: 0, remeasureNote: "", createdAt: now - 70000,
      },
      {
        id: "c2", code: "梁 LA-02", building: "报恩寺大殿", axis: "A轴",
        wood: "杉木", tenonType: "燕尾榫", section: "180×240mm",
        disease: { reviewed: true, criticalDefect: false, note: "端部微裂，已嵌补" },
        moisture: { measured: true, value: 14.2 },
        status: "eligible", remeasureVersion: 0, remeasureNote: "", createdAt: now - 69000,
      },
      {
        id: "c3", code: "枋 FA-03", building: "报恩寺大殿", axis: "A轴",
        wood: "松木", tenonType: "半榫", section: "120×180mm",
        disease: { reviewed: true, criticalDefect: false, note: "无明显病害" },
        moisture: { measured: true, value: 13.1 },
        status: "eligible", remeasureVersion: 0, remeasureNote: "", createdAt: now - 68000,
      },
      {
        id: "c4", code: "梁 LA-04", building: "报恩寺大殿", axis: "A轴",
        wood: "杉木", tenonType: "透榫", section: "160×220mm",
        disease: { reviewed: true, criticalDefect: false, note: "侧面虫蛀，非关键截面" },
        moisture: { measured: true, value: 21.8 },
        status: "repair", remeasureVersion: 0, remeasureNote: "", createdAt: now - 67000,
      },
      {
        id: "c5", code: "柱 ZA-05", building: "报恩寺大殿", axis: "A轴",
        wood: "楠木", tenonType: "箍头榫", section: "260×260mm",
        disease: { reviewed: true, criticalDefect: true, note: "榫头根部关键截面缺损" },
        moisture: { measured: true, value: 11.9 },
        status: "repair", remeasureVersion: 0, remeasureNote: "", createdAt: now - 66000,
      },
      {
        id: "c6", code: "枋 FA-06", building: "报恩寺大殿", axis: "A轴",
        wood: "松木", tenonType: "半榫", section: "110×170mm",
        disease: { reviewed: false, criticalDefect: false, note: "" },
        moisture: { measured: false, value: null },
        status: "registered", remeasureVersion: 0, remeasureNote: "", createdAt: now - 65000,
      },
      {
        id: "c7", code: "柱 ZB-01", building: "藏经阁", axis: "B轴",
        wood: "楠木", tenonType: "箍头榫", section: "230×230mm",
        disease: { reviewed: true, criticalDefect: false, note: "完好" },
        moisture: { measured: true, value: 12.9 },
        status: "eligible", remeasureVersion: 0, remeasureNote: "", createdAt: now - 64000,
      },
      {
        id: "c8", code: "梁 LB-01", building: "藏经阁", axis: "B轴",
        wood: "杉木", tenonType: "透榫", section: "170×230mm",
        disease: { reviewed: true, criticalDefect: false, note: "轻微变形，监测中" },
        moisture: { measured: true, value: 15.0 },
        status: "eligible", remeasureVersion: 0, remeasureNote: "", createdAt: now - 63000,
      },
    ],
    groups: [
      {
        id: "g1", name: "明间柱梁燕尾节点", batchId: "b1", tenonType: "燕尾榫",
        memberIds: ["c1", "c2"], status: "passed", slotId: null, createdAt: now - 50000,
      },
      {
        id: "g2", name: "明间柱枋半榫节点", batchId: "b1", tenonType: "半榫",
        memberIds: ["c1", "c3"], status: "queued", slotId: null, createdAt: now - 40000,
      },
      {
        id: "g3", name: "次间柱梁透榫节点", batchId: "b2", tenonType: "透榫",
        memberIds: ["c7", "c8"], status: "queued", slotId: null, createdAt: now - 30000,
      },
    ],
    trials: [],
  };

  // 种子：g1 已有一次有效通过记录（间隙 1.2mm ≤ 燕尾榫 1.5mm）
  const g1Members = state.components.filter((c) => ["c1", "c2"].includes(c.id));
  state.trials = [
    {
      id: "t1",
      groupId: "g1",
      groupName: "明间柱梁燕尾节点",
      batchId: "b1",
      slotId: "s1",
      fingerprint: groupFingerprint("b1", g1Members),
      members: [
        { componentId: "c1", code: "柱 ZA-01" },
        { componentId: "c2", code: "梁 LA-02" },
      ],
      tenonType: "燕尾榫",
      measuredGap: 1.2,
      allowance: 1.5,
      result: "pass",
      state: "active",
      archiveReason: null,
      createdAt: now - 45000,
      archivedAt: null,
    },
  ];
  return state;
}

export function loadState(): BenchState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as BenchState;
    if (!parsed || !Array.isArray(parsed.batches) || !Array.isArray(parsed.components)) {
      return seedState();
    }
    return parsed;
  } catch {
    return seedState();
  }
}

export function saveState(state: BenchState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时静默降级为内存态
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
