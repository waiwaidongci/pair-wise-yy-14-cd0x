/**
 * 操作界面：试装批（按建筑 + 轴线锁定）的建立与一览。
 */

import { useState } from "react";
import type { BenchApi } from "../store/useBench";
import { Badge, SectionHead } from "./bits";

export function BatchPanel({ bench }: { bench: BenchApi }) {
  const { state, createBatch } = bench;
  const [building, setBuilding] = useState("");
  const [axis, setAxis] = useState("");
  const [slotCount, setSlotCount] = useState(2);

  const occupancy = (batchId: string) => {
    const slots = state.slots.filter((s) => s.batchId === batchId);
    return { used: slots.filter((s) => s.groupId !== null).length, total: slots.length };
  };

  return (
    <section className="panel">
      <SectionHead kicker="试装批" title="批次 · 按建筑与轴线锁定" />
      <div className="batch-list">
        {state.batches.map((b) => {
          const occ = occupancy(b.id);
          return (
            <article className="batch-card" key={b.id}>
              <div>
                <h3>{b.building}</h3>
                <p>
                  {b.axis} · 试装位 {occ.used}/{occ.total} 占用
                </p>
              </div>
              <Badge tone="info">已锁定</Badge>
            </article>
          );
        })}
      </div>

      <div className="sub-form">
        <h3>新建试装批</h3>
        <label>
          <span>建筑名称</span>
          <input value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="如：报恩寺大殿" />
        </label>
        <label>
          <span>轴线</span>
          <input value={axis} onChange={(e) => setAxis(e.target.value)} placeholder="如：A轴" />
        </label>
        <label>
          <span>试装位数</span>
          <input
            type="number"
            min={1}
            max={4}
            value={slotCount}
            onChange={(e) => setSlotCount(Number(e.target.value))}
          />
        </label>
        <button
          className="primary"
          onClick={() => {
            createBatch({ building, axis, slotCount });
            setBuilding("");
            setAxis("");
          }}
        >
          建立并锁定
        </button>
      </div>
    </section>
  );
}
