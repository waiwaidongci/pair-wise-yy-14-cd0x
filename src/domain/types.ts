// 领域模型：木构榫卯试装放线台
// 本文件只定义数据结构，规则判断见 rules.ts，状态存储见 store/trialStore.ts

export type TenonType = "燕尾榫" | "透榫" | "半榫" | "箍头榫";

export const TENON_TYPES: TenonType[] = ["燕尾榫", "透榫", "半榫", "箍头榫"];

/** 构件：登记信息 + 病害复核/含水率检测原始数据 */
export interface ComponentItem {
  id: string;
  code: string; // 构件编号
  building: string; // 建筑名称
  axis: string; // 轴线
  wood: string; // 木材种类
  tenon: TenonType; // 榫卯类型
  section: string; // 截面尺寸
  diseaseReviewed: boolean; // 病害复核已完成
  keySectionDefect: boolean; // 关键截面缺损
  diseaseNote: string; // 病害部位/情况
  moisture: number | null; // 含水率 %
}

/** 构件状态（由规则推导，不直接落库） */
export type ComponentStatus = "pending" | "eligible" | "repair";

/** 试装批：按建筑 + 轴线锁定 */
export interface Batch {
  key: string; // building::axis
  building: string;
  axis: string;
  createdAt: number;
}

export type GroupStatus = "queued" | "on_slot" | "passed" | "returned";

/** 试装组：一组同台试装的构件 */
export interface TrialGroup {
  id: string;
  name: string;
  batchKey: string;
  componentIds: string[];
  status: GroupStatus;
  round: number; // 已完成的判定轮次
  enqueuedAt: number; // 最近一次入列时间（队列排序依据）
  slotId: string | null;
}

/** 试装位：同时只接纳一组构件 */
export interface TrialSlot {
  id: string;
  batchKey: string;
  label: string;
  groupId: string | null;
}

export type TrialResult = "pass" | "reject";

/** 试装记录：判定留痕；更换构件后旧记录置 archived 留档 */
export interface TrialRecord {
  id: string;
  groupId: string;
  groupName: string;
  batchKey: string;
  componentIds: string[]; // 判定时构件集合快照
  signature: string; // 构件集合签名（排序拼接），用于“重复试装沿用首次结果”
  round: number;
  measurements: Record<string, number>; // componentId -> 实测间隙 mm
  result: TrialResult;
  overLimit: string[]; // 超限构件 id
  createdAt: number;
  archived: boolean;
  archiveReason?: string;
}
