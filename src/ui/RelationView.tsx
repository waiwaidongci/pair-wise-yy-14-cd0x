// 构件关系视图：按试装批展示组内构件榫卯连接关系，与队列/判定状态同源
import { componentStatus } from "../domain/rules";
import { useTrialState } from "../store/useTrialStore";
import { ComponentBadge, GroupBadge } from "./common";

export function RelationView() {
  const state = useTrialState();

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>单栋建筑</p>
          <h2>构件关系视图</h2>
        </div>
      </div>
      {state.batches.map((b) => {
        const groups = state.groups.filter((g) => g.batchKey === b.key);
        const comps = state.components.filter((c) => c.building === b.building && c.axis === b.axis);
        const grouped = new Set(groups.flatMap((g) => g.componentIds));
        const loose = comps.filter((c) => !grouped.has(c.id));
        return (
          <div className="sub" key={b.key}>
            <h3>{b.building} · {b.axis}</h3>
            {groups.length === 0 && <p className="hint">本批尚未编组。</p>}
            {groups.map((g) => (
              <div className="relation-group" key={g.id}>
                <div className="row-item">
                  <b className="grow">{g.name}</b>
                  <GroupBadge status={g.status} />
                  <span className="hint">判定 {g.round} 轮</span>
                </div>
                <div className="joint-line">
                  {g.componentIds.map((id, i) => {
                    const c = state.components.find((x) => x.id === id);
                    if (!c) return null;
                    return (
                      <span key={id} className="joint-node">
                        {i > 0 && <span className="joint-link">⇄ 榫卯接缝</span>}
                        <span className="member-chip">
                          {c.code} · {c.tenon} · {c.section}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
            {loose.length > 0 && (
              <p className="hint">
                未编组构件：
                {loose.map((c) => (
                  <span key={c.id} className="member-chip dim">
                    {c.code} · {c.tenon} <ComponentBadge status={componentStatus(c)} />
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
