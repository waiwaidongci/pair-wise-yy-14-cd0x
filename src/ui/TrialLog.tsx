/**
 * 操作界面：试装记录与留档。
 * 有效记录与失效留档同表展示，换件失效的旧结论永久留档可查。
 */

import { batchOf } from "../domain/rules";
import type { BenchApi } from "../store/useBench";
import { Badge, fmtTime, SectionHead } from "./bits";

export function TrialLog({ bench }: { bench: BenchApi }) {
  const { state } = bench;
  const trials = [...state.trials].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <section className="panel">
      <SectionHead kicker="试装记录" title="结论与留档" />
      {trials.length === 0 ? (
        <p className="hint">暂无试装记录</p>
      ) : (
        <div className="trial-table-wrap">
          <table className="trial-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>试装批</th>
                <th>构件组</th>
                <th>构件快照</th>
                <th>榫型</th>
                <th>实测 / 允许</th>
                <th>结果</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((t) => {
                const batch = batchOf(state, t.batchId);
                return (
                  <tr key={t.id} className={t.state === "archived" ? "row-archived" : ""}>
                    <td>{fmtTime(t.createdAt)}</td>
                    <td>{batch ? `${batch.building} · ${batch.axis}` : "—"}</td>
                    <td>{t.groupName}</td>
                    <td>{t.members.map((m) => m.code).join(" ＋ ")}</td>
                    <td>{t.tenonType}</td>
                    <td>
                      {t.measuredGap}mm / ≤{t.allowance}mm
                    </td>
                    <td>
                      <Badge tone={t.result === "pass" ? "ok" : "bad"}>
                        {t.result === "pass" ? "通过" : "超限退回"}
                      </Badge>
                    </td>
                    <td>
                      {t.state === "active" ? (
                        <Badge tone="info">有效</Badge>
                      ) : (
                        <span className="archive-cell">
                          <Badge tone="muted">留档</Badge>
                          <small>
                            {t.archiveReason}
                            {t.archivedAt ? ` · ${fmtTime(t.archivedAt)}` : ""}
                          </small>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
