// 试装记录与留档：全部判定记录，含更换构件后的失效留档
import { useState } from "react";
import { ALLOWED_GAP } from "../domain/rules";
import { trialStore, useTrialState } from "../store/useTrialStore";
import { fmtTime, Msg } from "./common";

export function RecordsPanel() {
  const state = useTrialState();
  const [msg, setMsg] = useState("");
  const codeOf = (id: string) => state.components.find((c) => c.id === id)?.code ?? id;
  const tenonOf = (id: string) => state.components.find((c) => c.id === id)?.tenon;
  const batchName = (key: string) => {
    const b = state.batches.find((x) => x.key === key);
    return b ? `${b.building}·${b.axis}` : key;
  };
  const sorted = [...state.records].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>判定留痕</p>
          <h2>试装记录与留档</h2>
        </div>
        <button
          onClick={() => {
            const r = trialStore.resetAll();
            setMsg(r.message);
          }}
        >
          恢复初始数据
        </button>
      </div>
      <Msg text={msg} kind="ok" />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>试装批</th>
              <th>组 / 轮次</th>
              <th>结果</th>
              <th>间隙明细（实测 / 允许）</th>
              <th>留档</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className={r.archived ? "archived" : ""}>
                <td>{fmtTime(r.createdAt)}</td>
                <td>{batchName(r.batchKey)}</td>
                <td>{r.groupName} · 第{r.round}轮</td>
                <td>
                  <span className={`badge ${r.result === "pass" ? "res-pass" : "res-reject"}`}>
                    {r.result === "pass" ? "通过" : "超限退回"}
                  </span>
                </td>
                <td>
                  {r.componentIds.map((id) => {
                    const t = tenonOf(id);
                    const over = r.overLimit.includes(id);
                    return (
                      <span key={id} className={`member-chip ${over ? "chip-bad" : ""}`}>
                        {codeOf(id)}：{r.measurements[id]}mm{t ? ` / ≤${ALLOWED_GAP[t]}mm` : ""}
                      </span>
                    );
                  })}
                </td>
                <td>{r.archived ? <span className="badge b-archived">留档 · {r.archiveReason}</span> : "生效中"}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="hint">暂无试装记录。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
