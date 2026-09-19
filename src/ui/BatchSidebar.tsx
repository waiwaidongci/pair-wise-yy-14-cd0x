// 试装批侧栏：开批 + 批次概览（按建筑和轴线锁定）
import { useState } from "react";
import { trialStore, useTrialState } from "../store/useTrialStore";
import { Msg } from "./common";

export function BatchSidebar() {
  const state = useTrialState();
  const [building, setBuilding] = useState("慈宁宫东配殿");
  const [axis, setAxis] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(false);

  const submit = () => {
    const r = trialStore.openBatch(building, axis);
    setMsg(r.message);
    setErr(!r.ok);
    if (r.ok && !r.reused) setAxis("");
  };

  return (
    <aside className="panel">
      <h2>试装批</h2>
      <p className="hint">试装批按「建筑 + 轴线」锁定，批内编组与试装不得越轴。</p>
      <div className="batch-list">
        {state.batches.map((b) => {
          const slots = state.slots.filter((s) => s.batchKey === b.key);
          const busy = slots.filter((s) => s.groupId !== null).length;
          const queued = state.groups.filter((g) => g.batchKey === b.key && g.status === "queued").length;
          const comps = state.components.filter(
            (c) => c.building === b.building && c.axis === b.axis
          ).length;
          return (
            <article className="batch-item" key={b.key}>
              <h3>
                {b.building} · {b.axis}
              </h3>
              <p>
                构件 {comps} 件 · 试装位 {busy}/{slots.length} 占用 · 队列 {queued} 组
              </p>
            </article>
          );
        })}
        {state.batches.length === 0 && <p className="hint">尚未开立试装批。</p>}
      </div>
      <div className="stack">
        <label>
          <span>建筑名称</span>
          <input value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="如：慈宁宫东配殿" />
        </label>
        <label>
          <span>轴线</span>
          <input value={axis} onChange={(e) => setAxis(e.target.value)} placeholder="如：⑦轴" />
        </label>
        <button className="primary" onClick={submit}>
          开立试装批
        </button>
        <Msg text={msg} kind={err ? "err" : "ok"} />
      </div>
    </aside>
  );
}
