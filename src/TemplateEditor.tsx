import { useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import type { Asset } from "./planner";
import {
  WEEKDAYS,
  type Template,
  type TemplateField,
  type Rect,
} from "./template";
export default function TemplateEditor({
  asset,
  onChange,
  onClose,
}: {
  asset: Asset;
  onChange: (t: Template) => void;
  onClose: () => void;
}) {
  const t = asset.template || { fields: [], days: [] };
  const [selection, select] = useState("f0"),
    [weekday, setWeekday] = useState(0),
    [kind, setKind] = useState<TemplateField["kind"]>("number");
  const start = useRef<{ x: number; y: number } | null>(null);
  const isDay = selection.startsWith("d"),
    index = Number(selection.slice(1));
  const current: Rect | undefined = isDay
    ? t.days[index]?.area
    : t.fields[index];
  const field = !isDay ? t.fields[index] : undefined;
  const replace = (r: Partial<TemplateField>) => {
    if (isDay)
      onChange({
        ...t,
        days: t.days.map((d, i) =>
          i === index ? { ...d, area: { ...d.area, ...r } } : d,
        ),
      });
    else
      onChange({
        ...t,
        fields: t.fields.map((f, i) => (i === index ? { ...f, ...r } : f)),
      });
  };
  const addField = () => {
    const f: TemplateField = {
      kind,
      weekday: kind === "month" ? undefined : weekday,
      x: 75,
      y: 110,
      width: kind === "number" ? 30 : 140,
      height: 25,
      fontSize: 16,
      color: "#777777",
      background: "#ffffff",
      font: "serif",
      align: kind === "number" ? "center" : "left",
    };
    onChange({ ...t, fields: [...t.fields, f] });
    select(`f${t.fields.length}`);
  };
  const closeRef = useRef<HTMLButtonElement>(null);
  return (
    <div
      className="template-dialog-backdrop"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Tab") {
          const focusable = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>(
              'button,input,select,[tabindex="0"]',
            ),
          ).filter((el) => !el.hasAttribute("disabled"));
          const first = focusable[0],
            last = focusable.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div
        className="template-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Ajustar fechas de la plantilla"
      >
        <header>
          <div>
            <strong>Ajustar fechas de la plantilla</strong>
            <p>{asset.name}</p>
          </div>
          <button
            ref={closeRef}
            autoFocus
            onClick={onClose}
            aria-label="Cerrar editor de plantilla"
          >
            <X size={20} />
          </button>
        </header>
        <div className="template-editor-body">
          <div className="template-editor-controls">
            <p>
              Selecciona un campo y dibuja sobre el texto original para cubrirlo
              y sustituirlo. Las zonas de día delimitan qué borrar al cambiar de
              mes.
            </p>
            <label>
              Campo o zona
              <select
                aria-label="Campo o zona"
                value={selection}
                onChange={(e) => select(e.target.value)}
              >
                {t.fields.map((f, i) => (
                  <option key={`f${i}`} value={`f${i}`}>
                    {f.kind === "month"
                      ? "Mes"
                      : `${f.kind === "number" ? "Número" : "Día"} · ${WEEKDAYS[f.weekday ?? 0]}`}
                  </option>
                ))}
                {t.days.map((d, i) => (
                  <option key={`d${i}`} value={`d${i}`}>
                    Zona · {WEEKDAYS[d.weekday]}
                  </option>
                ))}
              </select>
            </label>
            {current && (
              <>
                <div className="rect-inputs">
                  {(["x", "y", "width", "height"] as const).map((k, i) => (
                    <label key={k}>
                      {["X", "Y", "Ancho", "Alto"][i]} (%)
                      <input
                        type="number"
                        min={k === "width" || k === "height" ? 0.1 : 0}
                        max="100"
                        step="0.1"
                        value={
                          +(
                            (current[k] /
                              (k === "x" || k === "width" ? 740 : 1050)) *
                            100
                          ).toFixed(1)
                        }
                        onChange={(e) => {
                          const max =
                            k === "x"
                              ? 740 - current.width
                              : k === "y"
                                ? 1050 - current.height
                                : k === "width"
                                  ? 740 - current.x
                                  : 1050 - current.y;
                          replace({
                            [k]: Math.max(
                              k === "width" || k === "height" ? 1 : 0,
                              Math.min(
                                max,
                                (+e.target.value / 100) *
                                  (k === "x" || k === "width" ? 740 : 1050),
                              ),
                            ),
                          });
                        }}
                      />
                    </label>
                  ))}
                </div>
                {field && (
                  <>
                    <label>
                      Tipografía
                      <select
                        value={field.font}
                        onChange={(e) =>
                          replace({
                            font: e.target.value as TemplateField["font"],
                          })
                        }
                      >
                        <option value="serif">Serif</option>
                        <option value="sans-serif">Sans serif</option>
                      </select>
                    </label>
                    <label>
                      Tamaño del texto
                      <input
                        type="number"
                        min="4"
                        max="100"
                        value={+field.fontSize.toFixed(1)}
                        step="0.5"
                        onChange={(e) =>
                          replace({
                            fontSize: Math.max(
                              4,
                              Math.min(100, +e.target.value),
                            ),
                          })
                        }
                      />
                    </label>
                    <div className="rect-inputs">
                      <label>
                        Texto
                        <input
                          aria-label="Color del texto de plantilla"
                          type="color"
                          value={field.color}
                          onChange={(e) => replace({ color: e.target.value })}
                        />
                      </label>
                      <label>
                        Fondo que tapa el original
                        <input
                          aria-label="Fondo del campo"
                          type="color"
                          value={field.background}
                          onChange={(e) =>
                            replace({ background: e.target.value })
                          }
                        />
                      </label>
                    </div>
                  </>
                )}
                <button
                  className="secondary"
                  onClick={() => {
                    if (isDay)
                      onChange({
                        ...t,
                        days: t.days.filter((_, i) => i !== index),
                      });
                    else
                      onChange({
                        ...t,
                        fields: t.fields.filter((_, i) => i !== index),
                      });
                    select("f0");
                  }}
                >
                  Eliminar {isDay ? "zona" : "campo"}
                </button>
              </>
            )}
            <hr />
            <label>
              Día de la semana
              <select
                value={weekday}
                onChange={(e) => setWeekday(+e.target.value)}
              >
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nuevo campo
              <select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as TemplateField["kind"])
                }
              >
                <option value="number">Número</option>
                <option value="weekday">Nombre del día</option>
                <option value="month">Mes</option>
              </select>
            </label>
            <button
              className="secondary"
              onClick={addField}
              disabled={t.fields.length >= 30}
            >
              <Plus size={15} />
              Añadir campo
            </button>
            <button
              className="secondary"
              disabled={
                t.days.some((d) => d.weekday === weekday) || t.days.length >= 7
              }
              onClick={() => {
                onChange({
                  ...t,
                  days: [
                    ...t.days,
                    {
                      weekday,
                      area: { x: 70, y: 100, width: 590, height: 200 },
                    },
                  ],
                });
                select(`d${t.days.length}`);
              }}
            >
              <Plus size={15} />
              Añadir zona de día
            </button>
          </div>
          <div className="template-editor-canvas">
            <div
              className="template-source"
              onPointerDown={(e) => {
                if (!current) return;
                const box = e.currentTarget.getBoundingClientRect();
                start.current = {
                  x: Math.max(
                    0,
                    Math.min(739, ((e.clientX - box.left) / box.width) * 740),
                  ),
                  y: Math.max(
                    0,
                    Math.min(1049, ((e.clientY - box.top) / box.height) * 1050),
                  ),
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerUp={(e) => {
                if (!start.current) return;
                const box = e.currentTarget.getBoundingClientRect();
                const x = Math.max(
                    0,
                    Math.min(740, ((e.clientX - box.left) / box.width) * 740),
                  ),
                  y = Math.max(
                    0,
                    Math.min(1050, ((e.clientY - box.top) / box.height) * 1050),
                  );
                if (
                  Math.abs(x - start.current.x) > 2 &&
                  Math.abs(y - start.current.y) > 2
                )
                  replace({
                    x: Math.min(x, start.current.x),
                    y: Math.min(y, start.current.y),
                    width: Math.abs(x - start.current.x),
                    height: Math.abs(y - start.current.y),
                  });
                start.current = null;
              }}
              onPointerCancel={() => {
                start.current = null;
              }}
            >
              <img
                src={asset.data}
                draggable={false}
                alt="Plantilla original: dibuja la zona del campo seleccionado"
              />
              {t.fields.map((f, i) => (
                <div
                  key={i}
                  className={`template-region ${selection === `f${i}` ? "selected" : ""}`}
                  style={{
                    left: `${(f.x / 740) * 100}%`,
                    top: `${(f.y / 1050) * 100}%`,
                    width: `${(f.width / 740) * 100}%`,
                    height: `${(f.height / 1050) * 100}%`,
                  }}
                />
              ))}
              {isDay && current && (
                <div
                  className="template-region selected"
                  style={{
                    left: `${(current.x / 740) * 100}%`,
                    top: `${(current.y / 1050) * 100}%`,
                    width: `${(current.width / 740) * 100}%`,
                    height: `${(current.height / 1050) * 100}%`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
        <footer>
          <span>
            Los ajustes se aplican a todas las páginas que usan esta plantilla.
          </span>
          <button className="primary" onClick={onClose}>
            Ver resultado
          </button>
        </footer>
      </div>
    </div>
  );
}
