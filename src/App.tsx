import "./styles.css";
import { MOISTURE_LIMIT_PCT } from "./domain/types";
import { useBenchStore } from "./store/useBench";
import { BatchPanel } from "./ui/BatchPanel";
import { ComponentPanel } from "./ui/ComponentPanel";
import { GroupPanel } from "./ui/GroupPanel";
import { RelationView } from "./ui/RelationView";
import { SlotBoard } from "./ui/SlotBoard";
import { TrialLog } from "./ui/TrialLog";

const RULE_CHIPS = [
  `含水率 > ${MOISTURE_LIMIT_PCT}% 或关键截面缺损 → 只能送修`,
  "一试装位一组 · 按榫型允许间隙判定",
  "超限退回修配 · 复测后方可复装",
  "换件即失效 · 旧记录留档重判",
  "重复试装沿用首次结果",
];

function App() {
  const bench = useBenchStore();
  const { state, notice, resetAll } = bench;

  const inSlotCount = state.groups.filter((g) => g.status === "inSlot").length;
  const repairCount = state.components.filter((c) => c.status === "repair").length;
  const archivedCount = state.trials.filter((t) => t.state === "archived").length;

  const metrics: Array<[string, number]> = [
    ["试装批", state.batches.length],
    ["试装位在位组", inSlotCount],
    ["送修构件", repairCount],
    ["留档记录", archivedCount],
  ];

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62013 · 古建木结构 · 试装放线台</p>
        <h1>木构榫卯试装放线台</h1>
        <span>
          试装批按建筑与轴线锁定；构件先完成病害复核与含水率检测方可入队，双检不合格只能送修。
          规则判断、状态存储与操作界面分层实现，队列、关系视图与结论刷新后保持一致。
        </span>
        <div className="chips">
          {RULE_CHIPS.map((r) => (
            <button key={r} type="button" tabIndex={-1}>
              {r}
            </button>
          ))}
        </div>
      </section>

      {notice && (
        <div className="notice" key={notice.at}>
          {notice.text}
        </div>
      )}

      <section className="metrics">
        {metrics.map(([label, value]) => (
          <article key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <div className="workspace">
        <BatchPanel bench={bench} />
        <SlotBoard bench={bench} />
      </div>

      <ComponentPanel bench={bench} />
      <GroupPanel bench={bench} />
      <RelationView bench={bench} />
      <TrialLog bench={bench} />

      <footer className="footer">
        <span>状态持久化于本地存储，刷新后队列、构件关系与结论一致恢复。</span>
        <button onClick={resetAll}>复位演示数据</button>
      </footer>
    </main>
  );
}

export default App;
