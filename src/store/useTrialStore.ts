// React 绑定：把独立存储桥接到组件，界面层不直接碰持久化细节
import { useSyncExternalStore } from "react";
import { trialStore, type TrialState } from "./trialStore";

export function useTrialState(): TrialState {
  return useSyncExternalStore(trialStore.subscribe, trialStore.getState);
}

export { trialStore };
export type { ActionResult } from "./trialStore";
