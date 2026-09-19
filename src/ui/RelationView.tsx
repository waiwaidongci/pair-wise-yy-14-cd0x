/**
 * 操作界面：单栋建筑的构件关系视图。
 * 以节点（构件组）为边、构件为点展示连接关系与当前结论；
 * 数据全部来自持久化状态，刷新后与队列一致。
 */

import { batchOf, componentsOf, groupVerdict } from "../domain/rules";
import type { BenchApi } from "../store/useBench";
import { Badge, COMPONENT_STATUS_META, SectionHead } from "./bits";

export function RelationView({ bench }: { bench: BenchApi }) {
  const { state } = bench;
  const buildings = Array.from(
    new Set([...state.batches.map((b) => b.building), ...state.components.map((c) => c.building)])
  );

  return (
    <section className="panel">
      <SectionHead kicker="构件关系视图" title="单栋建筑节点关系" />
      {buildings.map((building) => {
        const batches = state.batches.filter((b) => b.building === building);
        const components = state.components.filter((c) => c.building === building);
        const groupedIds = new Set(
          state.groups
            .filter((g) => batches.some((b) => b.id === g.batchId))
            .flatMap((g) => g.memberIds)
        );
        const ungrouped = components.filter((c) => !groupedIds.has(c.id));

        return (
          <div className="relation-building" key={building}>
            <h3>{building}</h3>
            {batches.map((batch) => {
              const groups = state.groups.filter((g) => g.batchId === batch.id);
              return (
                <div className="relation-batch" key={batch.id}>
                  <p className="relation-axis">
                    {batch.axis} · 试装批已锁定 · {groups.length} 组节点
                  </p>
                  {groups.map((g) => {
                    const members = componentsOf(state, g.memberIds);
                    const verdict = groupVerdict(state, g);
                    return (
                      <div className="joint-row" key={g.id}>
                        <span className="joint-name">{g.name}</span>
                        <span className="joint-members">
                          {members.map((m, i) => (
                            <span key={m.id}>
                              {i > 0 && <em className="joint-link">─⟨{g.tenonType}⟩─</em>}
                              <b className="joint-node">{m.code}</b>
                            </span>
                          ))}
                        </span>
                        <Badge tone={verdict.tone}>{verdict.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {ungrouped.length > 0 && (
              <p className="relation-ungrouped">
                未编组构件：
                {ungrouped.map((c) => (
                  <span className="member-chip" key={c.id}>
                    {c.code}
                    <Badge tone={COMPONENT_STATUS_META[c.status].tone}>
                      {COMPONENT_STATUS_META[c.status].label}
                    </Badge>
                  </span>
                ))}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
