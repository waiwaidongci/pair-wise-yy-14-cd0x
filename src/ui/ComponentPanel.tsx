// 构件面板：登记、病害复核与含水率检测录入、清单（榫型筛选）
import { useMemo, useState } from "react";
import { TENON_TYPES, type TenonType } from "../domain/types";
import { ALLOWED_GAP, MOISTURE_LIMIT, componentStatus } from "../domain/rules";
import { trialStore, useTrialState } from "../store/useTrialStore";
import { ComponentBadge, Msg } from "./common";

export function ComponentPanel() {
  const state = useTrialState();
  const [filter, setFilter] = useState<TenonType | "全部">("全部");
  const [regMsg, setRegMsg] = useState({ text: "", err: false });
  const [inspMsg, setInspMsg] = useState({ text: "", err: false });

  // 登记表单
  const [reg, setReg] = useState({
    code: "",
    building: "慈宁宫东配殿",
    axis: "",
    wood: "",
    tenon: "透榫" as TenonType,
    section: "",
  });

  // 检测表单
  const pending = state.components.filter((c) => componentStatus(c) === "pending");
  const [inspId, setInspId] = useState("");
  const [keyDefect, setKeyDefect] = useState(false);
  const [moisture, setMoisture] = useState("");
  const [note, setNote] = useState("");

  const list = useMemo(
    () => (filter === "全部" ? state.components : state.components.filter((c) => c.tenon === filter)),
    [state.components, filter]
  );

  const submitReg = () => {
    const r = trialStore.registerComponent(reg);
    setRegMsg({ text: r.message, err: !r.ok });
    if (r.ok) setReg({ ...reg, code: "", axis: "", wood: "", section: "" });
  };

  const submitInsp = () => {
    const r = trialStore.recordInspection(inspId, {
      diseaseReviewed: true,
      keySectionDefect: keyDefect,
      moisture: moisture === "" ? null : Number(moisture),
      diseaseNote: note.trim(),
    });
    setInspMsg({ text: r.message, err: !r.ok });
    if (r.ok) {
      setInspId("");
      setKeyDefect(false);
      setMoisture("");
      setNote("");
    }
  };

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>构件管理</p>
          <h2>登记 · 检测 · 清单</h2>
        </div>
      </div>

      <div className="subgrid">
        <div className="sub">
          <h3>构件登记</h3>
          <div className="field-grid">
            <label>
              <span>构件编号</span>
              <input value={reg.code} onChange={(e) => setReg({ ...reg, code: e.target.value })} placeholder="如：梁架A-04" />
            </label>
            <label>
              <span>建筑名称</span>
              <input value={reg.building} onChange={(e) => setReg({ ...reg, building: e.target.value })} />
            </label>
            <label>
              <span>轴线</span>
              <input value={reg.axis} onChange={(e) => setReg({ ...reg, axis: e.target.value })} placeholder="如：③轴" />
            </label>
            <label>
              <span>木材种类</span>
              <input value={reg.wood} onChange={(e) => setReg({ ...reg, wood: e.target.value })} placeholder="如：榆木" />
            </label>
            <label>
              <span>榫卯类型（允许间隙）</span>
              <select value={reg.tenon} onChange={(e) => setReg({ ...reg, tenon: e.target.value as TenonType })}>
                {TENON_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}（≤{ALLOWED_GAP[t]}mm）
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>截面尺寸</span>
              <input value={reg.section} onChange={(e) => setReg({ ...reg, section: e.target.value })} placeholder="如：180×240mm" />
            </label>
          </div>
          <button className="primary" onClick={submitReg}>登记构件</button>
          <Msg text={regMsg.text} kind={regMsg.err ? "err" : "ok"} />
        </div>

        <div className="sub">
          <h3>病害复核与含水率检测</h3>
          <p className="hint">
            含水率超过 {MOISTURE_LIMIT}% 或关键截面缺损的构件只能送修，不得占试装位。
          </p>
          <div className="stack">
            <label>
              <span>待检测构件</span>
              <select value={inspId} onChange={(e) => setInspId(e.target.value)}>
                <option value="">请选择</option>
                {pending.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.building}·{c.axis} · {c.tenon}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>含水率（%）</span>
              <input type="number" min="0" max="60" step="0.1" value={moisture} onChange={(e) => setMoisture(e.target.value)} placeholder="如：12.5" />
            </label>
            <label>
              <span>病害部位 / 情况</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：端部开裂" />
            </label>
            <label className="check">
              <input type="checkbox" checked={keyDefect} onChange={(e) => setKeyDefect(e.target.checked)} />
              <span>关键截面缺损（勾选即判定送修）</span>
            </label>
            <button className="primary" onClick={submitInsp} disabled={!inspId}>
              录入检测并判定
            </button>
            <Msg text={inspMsg.text} kind={inspMsg.err ? "err" : "ok"} />
          </div>
        </div>
      </div>

      <div className="chips">
        {(["全部", ...TENON_TYPES] as const).map((t) => (
          <button key={t} className={filter === t ? "chip-on" : ""} onClick={() => setFilter(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>构件编号</th>
              <th>建筑 · 轴线</th>
              <th>木材</th>
              <th>榫型</th>
              <th>截面</th>
              <th>含水率</th>
              <th>病害复核</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const st = componentStatus(c);
              return (
                <tr key={c.id}>
                  <td><b>{c.code}</b></td>
                  <td>{c.building} · {c.axis}</td>
                  <td>{c.wood}</td>
                  <td>{c.tenon}</td>
                  <td>{c.section}</td>
                  <td className={c.moisture !== null && c.moisture > MOISTURE_LIMIT ? "bad" : ""}>
                    {c.moisture === null ? "—" : `${c.moisture}%`}
                  </td>
                  <td>
                    {c.diseaseReviewed
                      ? c.keySectionDefect
                        ? `关键截面缺损${c.diseaseNote ? `（${c.diseaseNote}）` : ""}`
                        : c.diseaseNote || "未见影响装配病害"
                      : "未复核"}
                  </td>
                  <td><ComponentBadge status={st} /></td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr><td colSpan={8} className="hint">该榫型下暂无构件。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
