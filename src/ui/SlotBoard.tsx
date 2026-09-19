/**
 * 操作界面：试装位看板与待试装队列。
 * 一个试装位同时只接纳一组构件；在位的组按榫型允许间隙判定。
 */

import { useState } from "react";
import { componentsOf, groupVerdict } from "../domain/rules";
import { TENON_ALLOWANCE_MM, type AssemblyGroup, type Slot } from "../domain/types";
import type { BenchApi } from "../store/useBench";
import { Badge, SectionHead } from "./bits";

function SlotCard({ slot, bench }: { slot: Slot; bench: BenchApi }) {
  const { state, judgeGroup } = bench;
  const [gap, setGap] = useState("");
  const group = slot.groupId ? state.groups.find((g) => g.id === slot.groupId) : undefined;

  if (!group) {
    return (
      <div className="slot-card slot-empty">
        <b>{slot.index} 号试装位</b>
        <span>空位 · 一次只接纳一组构件</span>
      </div>
    );
  }

  const members = componentsOf(state, group.memberIds);
  const allowance = TENON_ALLOWANCE_MM[group.tenonType];
  return (
    <div className="slot-card slot-busy">
      <div className="slot-head">
        <b>{slot.index} 号试装位</b>
        <Badge tone="info">试装中</Badge>
      </div>
      <h4>{group.name}</h4>
      <p className="slot-members">{members.map((m) => m.code).join(" ＋ ")}</p>
      <p className="slot-hint">
        {group.tenonType} · 允许间隙 ≤ {allowance}mm
      </p>
      <div className="judge-row">
        <input
          type="number"
          step="0.1"
          min={0}
          placeholder="实测间隙 mm"
          value={gap}
          onChange={(e) => setGap(e.target.value)}
        />
        <button
          className="primary"
          onClick={() => {
            const outcome = judgeGroup(group.id, Number(gap));
            if (outcome) setGap("");
          }}
        >
          按榫型判定
        </button>
      </div>
    </div>
  );
}

function QueueRow({ group, bench }: { group: AssemblyGroup; bench: BenchApi }) {
  const { state, admitGroup } = bench;
  const verdict = groupVerdict(state, group);
  const members = componentsOf(state, group.memberIds);
  return (
    <li className="queue-row">
      <div>
        <b>{group.name}</b>
        <span>
          {members.map((m) => m.code).join(" ＋ ")} · {group.tenonType}
        </span>
      </div>
      <Badge tone={verdict.tone}>{verdict.label}</Badge>
      <button onClick={() => admitGroup(group.id)}>入位试装</button>
    </li>
  );
}

export function SlotBoard({ bench }: { bench: BenchApi }) {
  const { state } = bench;
  return (
    <section className="panel">
      <SectionHead kicker="试装位与队列" title="放线判定台" />
      {state.batches.map((batch) => {
        const slots = state.slots.filter((s) => s.batchId === batch.id);
        const queue = state.groups
          .filter((g) => g.batchId === batch.id && g.status !== "inSlot")
          .sort((a, b) => a.createdAt - b.createdAt);
        return (
          <div className="slot-batch" key={batch.id}>
            <h3>
              {batch.building} · {batch.axis}
            </h3>
            <div className="slot-grid">
              {slots.map((s) => (
                <SlotCard key={s.id} slot={s} bench={bench} />
              ))}
            </div>
            {queue.length > 0 && (
              <ul className="queue">
                {queue.map((g) => (
                  <QueueRow key={g.id} group={g} bench={bench} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
