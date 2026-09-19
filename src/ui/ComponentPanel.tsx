/**
 * 操作界面：构件登记、病害复核、含水率检测、修配与复测。
 * 走向（送修 / 可试装）由规则层判定，界面只录入与展示。
 */

import { useState } from "react";
import { evaluateChecks } from "../domain/rules";
import { MOISTURE_LIMIT_PCT, TENON_TYPES, type ComponentItem, type TenonType } from "../domain/types";
import type { BenchApi } from "../store/useBench";
import { Badge, COMPONENT_STATUS_META, SectionHead } from "./bits";

function ComponentCard({ item, bench }: { item: ComponentItem; bench: BenchApi }) {
  const { reviewDisease, measureMoisture, completeAdjustment, remeasureComponent } = bench;
  const [critical, setCritical] = useState(false);
  const [note, setNote] = useState("");
  const [moisture, setMoisture] = useState("");
  const [remeasureNote, setRemeasureNote] = useState("");

  const meta = COMPONENT_STATUS_META[item.status];
  const verdict = evaluateChecks(item);

  return (
    <article className={`component-card status-${item.status}`}>
      <div className="component-head">
        <h3>{item.code}</h3>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
      <p className="component-info">
        {item.building} · {item.axis} · {item.wood} · {item.tenonType} · {item.section}
      </p>

      {item.disease.reviewed && (
        <p className="check-line">
          病害复核：{item.disease.criticalDefect ? "关键截面缺损" : "无关键缺损"}
          {item.disease.note ? `（${item.disease.note}）` : ""}
        </p>
      )}
      {item.moisture.measured && (
        <p className="check-line">
          含水率：{item.moisture.value}%
          {item.moisture.value !== null && item.moisture.value > MOISTURE_LIMIT_PCT
            ? `（超 ${MOISTURE_LIMIT_PCT}% 上限）`
            : ""}
        </p>
      )}
      {item.status === "repair" && verdict.reasons.length > 0 && (
        <p className="check-line warn-line">送修原因：{verdict.reasons.join("；")}，不得占试装位</p>
      )}
      {item.remeasureNote && <p className="check-line">复测记录：{item.remeasureNote}</p>}

      {!item.disease.reviewed && (
        <div className="inline-form">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={critical}
              onChange={(e) => setCritical(e.target.checked)}
            />
            <span>关键截面缺损</span>
          </label>
          <input
            placeholder="病害位置与复核备注"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            onClick={() => {
              reviewDisease(item.id, critical, note);
              setNote("");
              setCritical(false);
            }}
          >
            确认复核
          </button>
        </div>
      )}

      {!item.moisture.measured && (
        <div className="inline-form">
          <input
            type="number"
            step="0.1"
            min={0}
            max={60}
            placeholder={`含水率 %（上限 ${MOISTURE_LIMIT_PCT}%）`}
            value={moisture}
            onChange={(e) => setMoisture(e.target.value)}
          />
          <button
            onClick={() => {
              measureMoisture(item.id, Number(moisture));
              setMoisture("");
            }}
          >
            记录检测
          </button>
        </div>
      )}

      {item.status === "adjusting" && (
        <div className="inline-form">
          <button onClick={() => completeAdjustment(item.id)}>修配完成</button>
        </div>
      )}

      {item.status === "remeasure" && (
        <div className="inline-form">
          <input
            placeholder="复测记录（如修配后截面尺寸）"
            value={remeasureNote}
            onChange={(e) => setRemeasureNote(e.target.value)}
          />
          <button
            className="primary"
            onClick={() => {
              remeasureComponent(item.id, remeasureNote);
              setRemeasureNote("");
            }}
          >
            复测登记
          </button>
        </div>
      )}
    </article>
  );
}

export function ComponentPanel({ bench }: { bench: BenchApi }) {
  const { state, registerComponent } = bench;
  const [code, setCode] = useState("");
  const [building, setBuilding] = useState("");
  const [axis, setAxis] = useState("");
  const [wood, setWood] = useState("");
  const [tenonType, setTenonType] = useState<TenonType>("燕尾榫");
  const [section, setSection] = useState("");

  return (
    <section className="panel">
      <SectionHead kicker="构件管理" title="登记 · 双检 · 修配复测" />
      <div className="register-grid">
        <label>
          <span>构件编号</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="如：梁 LA-07" />
        </label>
        <label>
          <span>建筑名称</span>
          <input value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="如：报恩寺大殿" />
        </label>
        <label>
          <span>轴线</span>
          <input value={axis} onChange={(e) => setAxis(e.target.value)} placeholder="如：A轴" />
        </label>
        <label>
          <span>木材种类</span>
          <input value={wood} onChange={(e) => setWood(e.target.value)} placeholder="如：杉木" />
        </label>
        <label>
          <span>榫卯类型</span>
          <select value={tenonType} onChange={(e) => setTenonType(e.target.value as TenonType)}>
            {TENON_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>截面尺寸</span>
          <input value={section} onChange={(e) => setSection(e.target.value)} placeholder="如：180×240mm" />
        </label>
        <button
          className="primary"
          onClick={() => {
            registerComponent({ code, building, axis, wood, tenonType, section });
            setCode("");
            setSection("");
          }}
        >
          登记构件
        </button>
      </div>

      <div className="component-grid">
        {state.components.map((c) => (
          <ComponentCard key={c.id} item={c} bench={bench} />
        ))}
      </div>
    </section>
  );
}
