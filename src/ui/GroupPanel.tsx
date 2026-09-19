/**
 * 操作界面：构件组编组与换件。
 * 编组与换件都受批次锁定（建筑 + 轴线）与占位规则约束；
 * 试装通过后换件 → 整组结论立即失效留档，按新件重判。
 */

import { useState } from "react";
import { admitCheck, batchOf, componentsOf, groupVerdict } from "../domain/rules";
import { TENON_TYPES, type AssemblyGroup, type TenonType } from "../domain/types";
import type { BenchApi } from "../store/useBench";
import { Badge, COMPONENT_STATUS_META, SectionHead } from "./bits";

function GroupCard({ group, bench }: { group: AssemblyGroup; bench: BenchApi }) {
  const { state, admitGroup, replaceMember } = bench;
  const [oldId, setOldId] = useState("");
  const [newId, setNewId] = useState("");

  const batch = batchOf(state, group.batchId);
  const members = componentsOf(state, group.memberIds);
  const verdict = groupVerdict(state, group);
  const candidates = state.components.filter(
    (c) =>
      batch &&
      c.building === batch.building &&
      c.axis === batch.axis &&
      !group.memberIds.includes(c.id) &&
      admitCheck(c).ok
  );

  return (
    <article className="group-card">
      <div className="component-head">
        <h3>{group.name}</h3>
        <Badge tone={verdict.tone}>{verdict.label}</Badge>
      </div>
      <p className="component-info">
        {batch ? `${batch.building} · ${batch.axis}` : "未知批次"} · 节点榫型 {group.tenonType}
      </p>
      <div className="member-chips">
        {members.map((m) => (
          <span className="member-chip" key={m.id}>
            {m.code}
            <Badge tone={COMPONENT_STATUS_META[m.status].tone}>{COMPONENT_STATUS_META[m.status].label}</Badge>
          </span>
        ))}
      </div>

      <div className="group-actions">
        {group.status !== "inSlot" && (
          <button className="primary" onClick={() => admitGroup(group.id)}>
            入位试装
          </button>
        )}
        {group.status === "inSlot" && <span className="hint">在试装位上，请到判定台测量判定</span>}
      </div>

      {group.status !== "inSlot" && (
        <div className="replace-row">
          <select value={oldId} onChange={(e) => setOldId(e.target.value)}>
            <option value="">换下构件…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code}
              </option>
            ))}
          </select>
          <select value={newId} onChange={(e) => setNewId(e.target.value)}>
            <option value="">换上构件…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}（{c.tenonType}）
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (!oldId || !newId) return;
              replaceMember(group.id, oldId, newId);
              setOldId("");
              setNewId("");
            }}
          >
            更换构件
          </button>
        </div>
      )}
    </article>
  );
}

export function GroupPanel({ bench }: { bench: BenchApi }) {
  const { state, createGroup } = bench;
  const [batchId, setBatchId] = useState("");
  const [name, setName] = useState("");
  const [tenonType, setTenonType] = useState<TenonType>("燕尾榫");
  const [picked, setPicked] = useState<string[]>([]);

  const batch = batchId ? batchOf(state, batchId) : undefined;
  const eligible = batch
    ? state.components.filter(
        (c) => c.building === batch.building && c.axis === batch.axis && admitCheck(c).ok
      )
    : [];

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <section className="panel">
      <SectionHead kicker="构件组" title="编组 · 换件重判" />
      <div className="register-grid">
        <label>
          <span>所属试装批（建筑 · 轴线锁定）</span>
          <select
            value={batchId}
            onChange={(e) => {
              setBatchId(e.target.value);
              setPicked([]);
            }}
          >
            <option value="">选择试装批…</option>
            {state.batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.building} · {b.axis}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>组名称</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：明间柱梁节点" />
        </label>
        <label>
          <span>节点榫型</span>
          <select value={tenonType} onChange={(e) => setTenonType(e.target.value as TenonType)}>
            {TENON_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary"
          onClick={() => {
            createGroup({ batchId, name, tenonType, memberIds: picked });
            setName("");
            setPicked([]);
          }}
        >
          编组入队
        </button>
      </div>

      {batch && (
        <div className="pick-list">
          {eligible.length === 0 && <p className="hint">该批次暂无双检合格、可占位的构件</p>}
          {eligible.map((c) => (
            <label className="checkbox" key={c.id}>
              <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
              <span>
                {c.code}（{c.tenonType} · {c.section}）
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="group-grid">
        {state.groups.map((g) => (
          <GroupCard key={g.id} group={g} bench={bench} />
        ))}
      </div>
    </section>
  );
}
