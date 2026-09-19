// 试装台：编组入列、试装位上位、测量判定、修配复装、通过组更换构件
import { useMemo, useState } from "react";
import { ALLOWED_GAP, componentStatus } from "../domain/rules";
import type { TrialGroup } from "../domain/types";
import { trialStore, useTrialState } from "../store/useTrialStore";
import { GroupBadge, Msg } from "./common";

export function TrialBench() {
  const state = useTrialState();
  const [batchKey, setBatchKey] = useState<string>(state.batches[0]?.key ?? "");
  const [picked, setPicked] = useState<string[]>([]);
  const [gaps, setGaps] = useState<Record<string, Record<string, string>>>({});
  const [swap, setSwap] = useState<Record<string, { out: string; in: string }>>({});
  const [msg, setMsg] = useState({ text: "", err: false });

  const activeKey = state.batches.some((b) => b.key === batchKey) ? batchKey : state.batches[0]?.key ?? "";
  const batch = state.batches.find((b) => b.key === activeKey);

  const groups = useMemo(
    () => state.groups.filter((g) => g.batchKey === activeKey),
    [state.groups, activeKey]
  );
  const queued = groups
    .filter((g) => g.status === "queued")
    .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
  const onSlot = groups.filter((g) => g.status === "on_slot");
  const returned = groups.filter((g) => g.status === "returned");
  const passed = groups.filter((g) => g.status === "passed");
  const slots = state.slots.filter((s) => s.batchKey === activeKey);

  const eligible = state.components.filter(
    (c) => batch && c.building === batch.building && c.axis === batch.axis && componentStatus(c) === "eligible"
  );
  const codeOf = (id: string) => state.components.find((c) => c.id === id)?.code ?? id;
  const compOf = (id: string) => state.components.find((c) => c.id === id);

  const say = (text: string, err = false) => setMsg({ text, err });

  const togglePick = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submitGroup = () => {
    const r = trialStore.formGroup(activeKey, picked);
    say(r.message, !r.ok);
    if (r.ok) setPicked([]);
  };

  const place = (g: TrialGroup) => {
    const r = trialStore.placeOnSlot(g.id);
    say(r.message, !r.ok);
  };

  const judge = (g: TrialGroup) => {
    const raw = gaps[g.id] ?? {};
    const measurements: Record<string, number> = {};
    for (const id of g.componentIds) {
      const v = raw[id];
      if (v !== undefined && v !== "") measurements[id] = Number(v);
    }
    const r = trialStore.judgeGroup(g.id, measurements);
    say(r.message, !r.ok);
    if (r.ok && !r.reused) setGaps((prev) => ({ ...prev, [g.id]: {} }));
  };

  const recheck = (g: TrialGroup) => {
    const r = trialStore.judgeGroup(g.id, {});
    say(r.message, !r.ok);
  };

  const refit = (g: TrialGroup) => {
    const r = trialStore.refitAndRequeue(g.id);
    say(r.message, !r.ok);
  };

  const doSwap = (g: TrialGroup) => {
    const sel = swap[g.id] ?? { out: "", in: "" };
    const r = trialStore.replaceComponent(g.id, sel.out, sel.in);
    say(r.message, !r.ok);
    if (r.ok) setSwap((prev) => ({ ...prev, [g.id]: { out: "", in: "" } }));
  };

  if (!batch) {
    return (
      <section className="panel">
        <h2>试装台</h2>
        <p className="hint">请先在左侧开立试装批。</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>放线试装</p>
          <h2>试装台 · {batch.building} · {batch.axis}</h2>
        </div>
      </div>

      <div className="chips">
        {state.batches.map((b) => (
          <button key={b.key} className={b.key === activeKey ? "chip-on" : ""} onClick={() => setBatchKey(b.key)}>
            {b.building} · {b.axis}
          </button>
        ))}
      </div>

      <div className="slot-grid">
        {slots.map((s) => {
          const g = s.groupId ? state.groups.find((x) => x.id === s.groupId) : null;
          return (
            <div key={s.id} className={`slot-card ${g ? "slot-busy" : ""}`}>
              <b>{s.label}</b>
              <span>{g ? `在位：${g.name}` : "空闲"}</span>
            </div>
          );
        })}
      </div>

      <div className="sub">
        <h3>编组入列</h3>
        <p className="hint">从本批检测合格构件中选取 2 件以上编组；相同构件组合重复提交将沿用首次结果。</p>
        <div className="chips">
          {eligible.map((c) => (
            <button key={c.id} className={picked.includes(c.id) ? "chip-on" : ""} onClick={() => togglePick(c.id)}>
              {c.code} · {c.tenon}
            </button>
          ))}
          {eligible.length === 0 && <span className="hint">本批暂无可试装构件。</span>}
        </div>
        <button className="primary" onClick={submitGroup} disabled={picked.length < 2}>
          编组入列（已选 {picked.length} 件）
        </button>
      </div>

      <div className="sub">
        <h3>试装队列</h3>
        {queued.length === 0 && <p className="hint">队列空。</p>}
        {queued.map((g, i) => (
          <div className="row-item" key={g.id}>
            <span className="seq">{i + 1}</span>
            <span className="grow">
              <b>{g.name}</b>（{g.componentIds.map(codeOf).join("、")}）
            </span>
            <GroupBadge status={g.status} />
            <button onClick={() => place(g)}>上位</button>
          </div>
        ))}
      </div>

      <div className="sub">
        <h3>在位测量判定</h3>
        {onSlot.length === 0 && <p className="hint">暂无在位试装组。</p>}
        {onSlot.map((g) => (
          <div className="group-card" key={g.id}>
            <div className="row-item">
              <b className="grow">{g.name}</b>
              <GroupBadge status={g.status} />
              <span className="hint">第 {g.round + 1} 轮判定</span>
            </div>
            {g.componentIds.map((id) => {
              const c = compOf(id);
              if (!c) return null;
              return (
                <label key={id} className="gap-input">
                  <span>
                    {c.code} · {c.tenon}（允许 ≤{ALLOWED_GAP[c.tenon]}mm）
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="实测间隙 mm"
                    value={gaps[g.id]?.[id] ?? ""}
                    onChange={(e) =>
                      setGaps((prev) => ({ ...prev, [g.id]: { ...(prev[g.id] ?? {}), [id]: e.target.value } }))
                    }
                  />
                </label>
              );
            })}
            <button className="primary" onClick={() => judge(g)}>按榫型允许间隙判定</button>
          </div>
        ))}
      </div>

      <div className="sub">
        <h3>退回修配</h3>
        {returned.length === 0 && <p className="hint">暂无退回构件组。</p>}
        {returned.map((g) => {
          const last = state.records
            .filter((r) => r.groupId === g.id && !r.archived)
            .sort((a, b) => b.createdAt - a.createdAt)[0];
          return (
            <div className="row-item" key={g.id}>
              <span className="grow">
                <b>{g.name}</b>
                {last && last.overLimit.length > 0 && (
                  <span className="bad">　超限：{last.overLimit.map(codeOf).join("、")}</span>
                )}
              </span>
              <GroupBadge status={g.status} />
              <button onClick={() => refit(g)}>修配完成 · 复装入列</button>
            </div>
          );
        })}
        {returned.length > 0 && <p className="hint">复装须重新上位并重新测量全部接缝。</p>}
      </div>

      <div className="sub">
        <h3>已通过 · 更换构件</h3>
        {passed.length === 0 && <p className="hint">暂无通过组。</p>}
        {passed.map((g) => {
          const rec = state.records
            .filter((r) => r.groupId === g.id && !r.archived)
            .sort((a, b) => a.createdAt - b.createdAt)[0];
          const sel = swap[g.id] ?? { out: "", in: "" };
          const outComp = compOf(sel.out);
          const candidates = state.components.filter(
            (c) =>
              batch &&
              c.building === batch.building &&
              c.axis === batch.axis &&
              componentStatus(c) === "eligible" &&
              !g.componentIds.includes(c.id) &&
              (!outComp || c.tenon === outComp.tenon)
          );
          return (
            <div className="group-card" key={g.id}>
              <div className="row-item">
                <b className="grow">{g.name}</b>
                <GroupBadge status={g.status} />
                {rec && <span className="hint">首次通过：第 {rec.round} 轮</span>}
                <button onClick={() => recheck(g)}>复验（沿用首次结果）</button>
              </div>
              <p className="hint">成员：{g.componentIds.map(codeOf).join("、")}。更换任一构件，整组结论立即失效，旧记录留档并按新件重判。</p>
              <div className="swap-row">
                <select
                  value={sel.out}
                  onChange={(e) => setSwap((p) => ({ ...p, [g.id]: { out: e.target.value, in: "" } }))}
                >
                  <option value="">被换构件</option>
                  {g.componentIds.map((id) => (
                    <option key={id} value={id}>{codeOf(id)}</option>
                  ))}
                </select>
                <span>→</span>
                <select
                  value={sel.in}
                  onChange={(e) => setSwap((p) => ({ ...p, [g.id]: { ...sel, in: e.target.value } }))}
                >
                  <option value="">替换构件（同榫型合格件）</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} · {c.tenon}</option>
                  ))}
                </select>
                <button className="primary" onClick={() => doSwap(g)} disabled={!sel.out || !sel.in}>
                  更换并重判
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Msg text={msg.text} kind={msg.err ? "err" : "ok"} />
    </section>
  );
}
