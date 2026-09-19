/**
 * 领域类型：木构榫卯试装放线台
 * 仅定义数据结构与业务常量，不含任何判断逻辑与界面代码。
 */

export type TenonType = "燕尾榫" | "透榫" | "半榫" | "箍头榫";

export const TENON_TYPES: TenonType[] = ["燕尾榫", "透榫", "半榫", "箍头榫"];

/** 各榫型允许的最大装配间隙（mm），判定依据 */
export const TENON_ALLOWANCE_MM: Record<TenonType, number> = {
  燕尾榫: 1.5,
  透榫: 2.0,
  半榫: 2.5,
  箍头榫: 1.0,
};

/** 含水率上限（%）：超过即只能送修，不得占试装位 */
export const MOISTURE_LIMIT_PCT = 18;

/** 构件生命周期 */
export type ComponentStatus =
  | "registered" // 已登记，病害复核 / 含水率检测未完成
  | "eligible" // 双检合格，可占试装位
  | "repair" // 含水率超限或关键截面缺损，只能送修
  | "adjusting" // 试装超限，退回修配
  | "remeasure"; // 修配完成，必须重新测量后才能复装

export interface DiseaseReview {
  reviewed: boolean;
  /** 关键截面缺损 */
  criticalDefect: boolean;
  note: string;
}

export interface MoistureTest {
  measured: boolean;
  /** 含水率 % */
  value: number | null;
}

export interface ComponentItem {
  id: string;
  code: string;
  building: string;
  axis: string;
  wood: string;
  tenonType: TenonType;
  section: string;
  disease: DiseaseReview;
  moisture: MoistureTest;
  status: ComponentStatus;
  /** 修配后复测次数：计入组指纹，复测后旧试装结论不再沿用 */
  remeasureVersion: number;
  remeasureNote: string;
  createdAt: number;
}

/** 试装批：按建筑 + 轴线锁定，同建筑同轴线只允许一个批 */
export interface Batch {
  id: string;
  building: string;
  axis: string;
  slotCount: number;
  createdAt: number;
}

/** 试装位：同一时刻只接纳一组构件 */
export interface Slot {
  id: string;
  batchId: string;
  index: number;
  groupId: string | null;
}

export type GroupStatus =
  | "queued" // 排队待试装
  | "inSlot" // 占用试装位
  | "passed" // 试装通过
  | "returned"; // 超限退回修配

export interface AssemblyGroup {
  id: string;
  name: string;
  batchId: string;
  tenonType: TenonType;
  memberIds: string[];
  status: GroupStatus;
  slotId: string | null;
  createdAt: number;
}

export interface TrialMemberSnapshot {
  componentId: string;
  code: string;
}

export interface TrialRecord {
  id: string;
  groupId: string;
  groupName: string;
  batchId: string;
  slotId: string;
  /** 批 + 构件集合 + 测量版本，重复试装凭它沿用首次结果 */
  fingerprint: string;
  members: TrialMemberSnapshot[];
  tenonType: TenonType;
  measuredGap: number;
  allowance: number;
  result: "pass" | "fail";
  /** active = 当前有效；archived = 换件失效后留档 */
  state: "active" | "archived";
  archiveReason: string | null;
  createdAt: number;
  archivedAt: number | null;
}

export interface BenchState {
  batches: Batch[];
  slots: Slot[];
  components: ComponentItem[];
  groups: AssemblyGroup[];
  trials: TrialRecord[];
  seq: number;
}
