import "./styles.css";
import { componentStatus } from "./domain/rules";
import { useTrialState } from "./store/useTrialStore";
import { BatchSidebar } from "./ui/BatchSidebar";
import { ComponentPanel } from "./ui/ComponentPanel";
import { TrialBench } from "./ui/TrialBench";
import { RelationView } from "./ui/RelationView";
import { RecordsPanel } from "./ui/RecordsPanel";

const project = {
  id: "hxyfront-62013",
  sourceNo: 8,
  port: 62013,
  title: "木构榫卯试装放线台",
};

function App() {
  const state = useTrialState();
  const pending = state.components.filter((c) => componentStatus(c) === "pending").length;
  const repair = state.components.filter((c) => componentStatus(c) === "repair").length;
  const passedGroups = state.groups.filter((g) => g.status === "passed").length;
  const metrics = [
    { label: "构件数量", value: state.components.length },
    { label: "待检测", value: pending },
    { label: "送修构件", value: repair },
    { label: "通过试装组", value: passedGroups },
  ];

  return (
    <main className="app">
      <section className="hero">
        <p>{project.id} · 源提示词{project.sourceNo} · Port {project.port}</p>
        <h1>{project.title}</h1>
        <span>
          试装批按建筑和轴线锁定；构件须先完成病害复核与含水率检测，含水率超 18%
          或关键截面缺损者只能送修，不得占试装位。一个试装位同时只接纳一组构件，按榫型允许间隙判定，
          超限退回修配、重新测量后方可复装；试装通过后更换任一构件，整组结论立即失效，旧记录留档并按新件重判；
          重复试装沿用首次结果。
        </span>
      </section>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      <div className="workspace">
        <BatchSidebar />
        <div className="main-col">
          <ComponentPanel />
          <TrialBench />
          <RelationView />
          <RecordsPanel />
        </div>
      </div>
    </main>
  );
}

export default App;
