import { t } from "./i18n";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Asset } from "./planner";
import {
  designPng,
  calendarElementText,
  designElementLabel,
  designSvg,
  type Design,
  type DesignElement,
} from "./design";
import "./PageDesigner.css";
import {
  bounds,
  snapElement,
  resizeElement,
  type ResizeHandle,
} from "./design-geometry";

const element = (kind: DesignElement["kind"]): DesignElement => ({
  id: crypto.randomUUID(),
  kind,
  x: 100,
  y: 150,
  width: kind === "text" ? 450 : 280,
  height: kind === "line" ? 3 : 140,
  rotation: 0,
  color: kind === "writing" ? "#a8a29e" : "#292524",
  ...(kind === "writing"
    ? { writingStyle: "lines" as const, spacing: 20, strokeWidth: 0.75 }
    : {}),
  fontSize: 36,
  font: "sans-serif",
  text: t("element.defaultText"),
  src: "",
});
// Keep image sources stable while dragging: only the element transform changes.
const ElementArtwork = memo(function ElementArtwork({
  element: e,
}: {
  element: DesignElement;
}) {
  const {
    kind,
    width,
    height,
    color,
    fontSize,
    font,
    text,
    src,
    writingStyle,
    spacing,
    strokeWidth,
  } = { ...e, text: calendarElementText(e) };
  const artwork = useMemo(() => {
    const local = {
      id: "art",
      kind,
      width,
      height,
      color,
      fontSize,
      font,
      text,
      src,
      writingStyle,
      spacing,
      strokeWidth,
      x: 0,
      y: 0,
      rotation: 0,
    };
    const svg = designSvg({
      background: "transparent",
      showCalendar: false,
      elements: [local],
    }).replace(
      'width="740" height="1050" viewBox="0 0 740 1050"',
      `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"`,
    );
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [
    kind,
    width,
    height,
    color,
    fontSize,
    font,
    text,
    src,
    writingStyle,
    spacing,
    strokeWidth,
  ]);
  return (
    <img
      className="designer-element-art"
      src={artwork}
      draggable={false}
      alt=""
    />
  );
});
export default function PageDesigner({
  asset,
  title,
  interior,
  calendar,
  calendarElements,
  onSave,
  onClose,
}: {
  asset?: Asset;
  title: string;
  interior: boolean;
  calendar?: string;
  calendarElements?: DesignElement[];
  onSave: (asset: Asset) => void;
  onClose: () => void;
}) {
  const names = {
    text: t("element.text"),
    rect: t("element.rect"),
    ellipse: t("element.ellipse"),
    line: t("element.line"),
    image: t("element.image"),
    writing: t("element.writing"),
  };
  const initial: Design = asset?.design || {
    background: "#ffffff",
    showCalendar: interior && !asset?.template,
    elements: asset
      ? [
          {
            ...element("image"),
            x: 0,
            y: 0,
            width: 740,
            height: 1050,
            src: asset.data,
          },
        ]
      : [],
  };
  const [history, setHistory] = useState<Design[]>(() => [
    {
      ...initial,
      ...(calendarElements && !initial.editableCalendar
        ? {
            editableCalendar: true,
            elements: [...initial.elements, ...calendarElements],
          }
        : {}),
    },
  ]);
  const [cursor, setCursor] = useState(0);
  const design = history[cursor];
  const [selected, select] = useState<string | null>(null);
  const current = design.elements.find((e) => e.id === selected);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Design | null>(null);
  const shown = draft || design;
  const active = shown.elements.find((e) => e.id === selected);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fitScale, setFitScale] = useState(0.6);
  const scale = zoom === "fit" ? fitScale : zoom;
  const [showGuides, setShowGuides] = useState(true);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const canvas = useRef<HTMLDivElement>(null);
  const pending = useRef<Design | null>(null);
  const frame = useRef<number | null>(null);
  const activeBounds = active ? bounds(active) : null;
  const centeredX =
    activeBounds &&
    Math.abs(activeBounds.x + activeBounds.width / 2 - 370) < 0.1;
  const centeredY =
    activeBounds &&
    Math.abs(activeBounds.y + activeBounds.height / 2 - 525) < 0.1;
  useEffect(() => {
    const el = canvas.current!;
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth - 48;
      const height = window.innerWidth <= 640 ? 650 : el.clientHeight - 48;
      setFitScale(Math.max(0.1, Math.min(width / 740, height / 1050, 1)));
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);
  function finishDrag(cancel = false) {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (!cancel && pending.current) commit(pending.current);
    pending.current = null;
    setDraft(null);
    setGuides({});
    drag.current = null;
  }
  const drag = useRef<{
    x: number;
    y: number;
    element: DesignElement;
    resize: ResizeHandle | undefined;
    scale: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const commit = (next: Design) => {
    setHistory((h) => [...h.slice(0, cursor + 1).slice(-49), next]);
    setCursor(Math.min(cursor + 1, 49));
  };
  const patch = (values: Partial<DesignElement>) => {
    if (current)
      commit({
        ...design,
        elements: design.elements.map((e) =>
          e.id === selected ? { ...e, ...values } : e,
        ),
      });
  };
  const add = (kind: DesignElement["kind"]) => {
    const e = element(kind);
    commit({ ...design, elements: [...design.elements, e] });
    select(e.id);
  };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  async function images(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    setError("");
    try {
      const added: DesignElement[] = [];
      for (const file of files) {
        if (
          !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
          file.size > 15 * 1024 * 1024
        )
          throw new Error(t("upload.requirements"));
        const src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const img = new Image();
        img.src = src;
        await img.decode();
        const scale = Math.min(500 / img.width, 700 / img.height, 1);
        added.push({
          ...element("image"),
          src,
          width: img.width * scale,
          height: img.height * scale,
        });
      }
      commit({ ...design, elements: [...design.elements, ...added] });
      select(added.at(-1)!.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("upload.failed"));
    } finally {
      setBusy(false);
    }
  }
  function moveLayer(direction: number) {
    const list = [...design.elements];
    const from = list.findIndex((e) => e.id === selected);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    commit({ ...design, elements: list });
  }
  return (
    <div className="designer-backdrop">
      <div
        ref={dialog}
        className="designer"
        role="dialog"
        aria-modal="true"
        aria-label={t("editor.dialog", { title })}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files);
          if (files.length && !busy) {
            e.preventDefault();
            void images(files);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            const controls = Array.from(
              dialog.current!.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
              ),
            );
            const first = controls[0],
              last = controls.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
          const input = /INPUT|TEXTAREA|SELECT/.test(
            (e.target as HTMLElement).tagName,
          );
          if (
            !input &&
            !busy &&
            (e.metaKey || e.ctrlKey) &&
            e.key.toLowerCase() === "z"
          ) {
            e.preventDefault();
            setCursor((c) =>
              Math.max(
                0,
                Math.min(history.length - 1, c + (e.shiftKey ? 1 : -1)),
              ),
            );
          }
          if (
            !input &&
            !busy &&
            current &&
            (e.key === "Delete" || e.key === "Backspace")
          ) {
            e.preventDefault();
            commit({
              ...design,
              elements: design.elements.filter((el) => el.id !== selected),
            });
            select(null);
          }
        }}
      >
        <header className="designer-header">
          <strong>{t("editor.title", { title })}</strong>
          <div>
            <button
              autoFocus
              className="secondary"
              disabled={busy}
              onClick={onClose}
            >
              {t("action.cancel")}
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const data = await designPng(design);
                  onSave({
                    name: t("asset.customName", { title }),
                    data,
                    design,
                    template: asset?.template,
                  });
                } catch {
                  setError(t("editor.saveFailed"));
                  setBusy(false);
                }
              }}
            >
              {busy ? t("editor.processing") : t("editor.save")}
            </button>
          </div>
        </header>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <fieldset
          className="designer-tools"
          disabled={busy}
          aria-label={t("editor.tools")}
        >
          {(["text", "rect", "ellipse", "line", "writing"] as const).map(
            (kind) => (
              <button
                key={kind}
                className="secondary"
                onClick={() => add(kind)}
              >
                {names[kind]}
              </button>
            ),
          )}
          <label className="secondary designer-upload">
            {t("editor.addImage")}
            <input
              aria-label={t("editor.uploadLabel")}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(e) => {
                void images(Array.from(e.target.files || []));
                e.target.value = "";
              }}
            />
          </label>
          <button
            disabled={cursor === 0 || busy}
            onClick={() => setCursor(cursor - 1)}
          >
            {t("action.undo")}
          </button>
          <button
            disabled={cursor === history.length - 1 || busy}
            onClick={() => setCursor(cursor + 1)}
          >
            {t("action.redo")}
          </button>
        </fieldset>
        <div className="designer-view-tools" aria-label={t("editor.view")}>
          <div className="designer-zoom">
            <button
              aria-label={t("zoom.out")}
              disabled={scale <= 0.25}
              onClick={() => setZoom(Math.max(0.25, scale - 0.1))}
            >
              −
            </button>
            <label>
              {t("zoom.label")}{" "}
              <select
                aria-label={t("zoom.canvas")}
                value={zoom === "fit" ? "fit" : String(zoom)}
                onChange={(e) =>
                  setZoom(
                    e.target.value === "fit" ? "fit" : Number(e.target.value),
                  )
                }
              >
                <option value="fit">
                  {t("zoom.fit", { percent: Math.round(fitScale * 100) })}
                </option>
                {![0.25, 0.5, 0.75, 1, 1.5, 2].includes(scale) &&
                  zoom !== "fit" && (
                    <option value={scale}>{Math.round(scale * 100)}%</option>
                  )}
                {[0.25, 0.5, 0.75, 1, 1.5, 2].map((value) => (
                  <option value={value} key={value}>
                    {value * 100}%
                  </option>
                ))}
              </select>
            </label>
            <button
              aria-label={t("zoom.in")}
              disabled={scale >= 2}
              onClick={() => setZoom(Math.min(2, scale + 0.1))}
            >
              +
            </button>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={showGuides}
              onChange={(e) => {
                setShowGuides(e.target.checked);
                setGuides({});
              }}
            />
            {t("editor.guides")}
          </label>
          <span>{t("editor.measurements")}</span>
        </div>
        <div className="designer-body">
          <div
            className="designer-canvas"
            ref={canvas}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) void images(Array.from(e.dataTransfer.files));
            }}
          >
            <div
              className="designer-stage"
              style={{ minWidth: 740 * scale, minHeight: 1050 * scale }}
            >
              <div
                ref={board}
                className="designer-paper"
                aria-label={t("editor.canvas")}
                style={{
                  width: 740 * scale,
                  height: 1050 * scale,
                  background: shown.background,
                }}
                onPointerDown={() => select(null)}
              >
                {shown.elements
                  .filter((el) => !el.calendar || shown.showCalendar)
                  .map((el) => (
                    <div
                      key={el.id}
                      data-element-id={el.id}
                      data-line={el.kind === "line" || undefined}
                      className={`designer-element ${selected === el.id ? "selected" : ""}`}
                      style={{
                        left: `${el.x / 7.4}%`,
                        top: `${el.y / 10.5}%`,
                        width: `${el.width / 7.4}%`,
                        height: `${el.height / 10.5}%`,
                        transform: `rotate(${el.rotation}deg)`,
                      }}
                      onPointerDown={(e) => {
                        if (busy || e.button !== 0) return;
                        e.preventDefault();
                        e.stopPropagation();
                        select(el.id);
                        drag.current = {
                          x: e.clientX,
                          y: e.clientY,
                          element: el,
                          scale:
                            board.current!.getBoundingClientRect().width / 740,
                          scrollLeft: canvas.current!.scrollLeft,
                          scrollTop: canvas.current!.scrollTop,
                          resize: (e.target as HTMLElement).dataset.resize as
                            | ResizeHandle
                            | undefined,
                        };
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={(e) => {
                        const start = drag.current;
                        if (!start || start.element.id !== el.id) return;
                        const dx =
                            (e.clientX -
                              start.x +
                              canvas.current!.scrollLeft -
                              start.scrollLeft) /
                            start.scale,
                          dy =
                            (e.clientY -
                              start.y +
                              canvas.current!.scrollTop -
                              start.scrollTop) /
                            start.scale;
                        const r = start.element;
                        const changes = start.resize
                          ? resizeElement(r, start.resize, dx, dy)
                          : {
                              x: Math.max(0, Math.min(740 - r.width, r.x + dx)),
                              y: Math.max(
                                0,
                                Math.min(1050 - r.height, r.y + dy),
                              ),
                            };
                        let moved = { ...r, ...changes };
                        let nextGuides: { x?: number; y?: number } = {};
                        if (!start.resize && showGuides && !e.altKey) {
                          const result = snapElement(
                            moved,
                            design.elements,
                            5 / start.scale,
                          );
                          moved = result.element;
                          nextGuides = result.guides;
                        }
                        pending.current = {
                          ...design,
                          elements: design.elements.map((item) =>
                            item.id === el.id ? moved : item,
                          ),
                        };
                        if (frame.current !== null)
                          cancelAnimationFrame(frame.current);
                        frame.current = requestAnimationFrame(() => {
                          setDraft(pending.current);
                          setGuides(nextGuides);
                          frame.current = null;
                        });
                      }}
                      onPointerUp={() => finishDrag()}
                      onPointerCancel={() => finishDrag(true)}
                      onLostPointerCapture={() => {
                        if (drag.current) finishDrag(true);
                      }}
                    >
                      <ElementArtwork element={el} />
                      {selected === el.id && (
                        <>
                          {(["n", "s", "e", "w", "se"] as const).map(
                            (handle) => (
                              <span
                                key={handle}
                                className={`designer-resize resize-${handle}`}
                                data-resize={handle}
                                title={
                                  {
                                    n: t("resize.top"),
                                    s: t("resize.bottom"),
                                    e: t("resize.right"),
                                    w: t("resize.left"),
                                    se: t("resize.corner"),
                                  }[handle]
                                }
                              />
                            ),
                          )}
                        </>
                      )}
                    </div>
                  ))}
                {interior &&
                  !shown.editableCalendar &&
                  (shown.showCalendar || asset?.template) &&
                  calendar && (
                    <img
                      className="designer-calendar"
                      draggable={false}
                      src={calendar}
                      alt={t("editor.reference")}
                    />
                  )}
                {showGuides && activeBounds && (
                  <svg
                    className="designer-guides"
                    viewBox="0 0 740 1050"
                    aria-label={t("editor.distances")}
                  >
                    {(guides.x !== undefined || centeredX) && (
                      <line
                        className="alignment-guide"
                        data-axis="x"
                        x1={guides.x ?? 370}
                        x2={guides.x ?? 370}
                        y1="0"
                        y2="1050"
                      />
                    )}
                    {(guides.y !== undefined || centeredY) && (
                      <line
                        className="alignment-guide"
                        data-axis="y"
                        x1="0"
                        x2="740"
                        y1={guides.y ?? 525}
                        y2={guides.y ?? 525}
                      />
                    )}
                    {(() => {
                      const b = activeBounds,
                        cx = b.x + b.width / 2,
                        cy = b.y + b.height / 2;
                      return [
                        {
                          x1: 0,
                          y1: cy,
                          x2: b.x,
                          y2: cy,
                          value: b.x,
                          label: t("edge.left"),
                          equal: centeredX,
                        },
                        {
                          x1: b.x + b.width,
                          y1: cy,
                          x2: 740,
                          y2: cy,
                          value: 740 - b.x - b.width,
                          label: t("edge.right"),
                          equal: centeredX,
                        },
                        {
                          x1: cx,
                          y1: 0,
                          x2: cx,
                          y2: b.y,
                          value: b.y,
                          label: t("edge.top"),
                          equal: centeredY,
                        },
                        {
                          x1: cx,
                          y1: b.y + b.height,
                          x2: cx,
                          y2: 1050,
                          value: 1050 - b.y - b.height,
                          label: t("edge.bottom"),
                          equal: centeredY,
                        },
                      ].map((g) => (
                        <g
                          key={g.label}
                          className={
                            g.equal ? "distance-guide equal" : "distance-guide"
                          }
                        >
                          <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} />
                          <text
                            x={Math.max(
                              35 / scale,
                              Math.min(740 - 35 / scale, (g.x1 + g.x2) / 2),
                            )}
                            y={Math.max(
                              16 / scale,
                              Math.min(
                                1050 - 8 / scale,
                                (g.y1 + g.y2) / 2 - 6 / scale,
                              ),
                            )}
                            textAnchor="middle"
                            style={{ fontSize: 11 / scale }}
                            aria-label={t("editor.distance", {
                              edge: g.label,
                              value: Math.round(g.value),
                            })}
                          >
                            {Math.round(g.value)} px
                          </text>
                        </g>
                      ));
                    })()}
                  </svg>
                )}
              </div>
            </div>
            <p className="designer-tip">{t("editor.tip")}</p>
          </div>
          <fieldset className="designer-properties" disabled={busy}>
            <label>
              {t("editor.background")}
              <input
                type="color"
                value={design.background}
                onChange={(e) =>
                  commit({ ...design, background: e.target.value })
                }
              />
            </label>
            {interior && !asset?.template && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={design.showCalendar}
                  onChange={(e) =>
                    commit({ ...design, showCalendar: e.target.checked })
                  }
                />
                {t("editor.calendar")}
              </label>
            )}
            {asset?.template && (
              <p className="hint">{t("editor.templateHint")}</p>
            )}
            {current ? (
              <>
                <h2>{designElementLabel(current)}</h2>
                {current.calendar && current.kind === "text" && (
                  <p className="hint">{t("editor.dynamicHint")}</p>
                )}
                {current.kind === "text" && (
                  <>
                    <label>
                      {t("editor.content")}
                      <textarea
                        value={current.text}
                        onChange={(e) => patch({ text: e.target.value })}
                      />
                    </label>
                    <label>
                      {t("editor.font")}
                      <select
                        value={current.font}
                        onChange={(e) =>
                          patch({
                            font: e.target.value as DesignElement["font"],
                          })
                        }
                      >
                        <option value="sans-serif">{t("font.sans")}</option>
                        <option value="serif">{t("font.serif")}</option>
                      </select>
                    </label>
                    <label>
                      {t("editor.fontSize")}
                      <input
                        type="number"
                        min="8"
                        max="200"
                        value={current.fontSize}
                        onChange={(e) =>
                          patch({
                            fontSize: Math.max(
                              8,
                              Math.min(200, +e.target.value),
                            ),
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {current.kind === "writing" && (
                  <>
                    <label>
                      {t("writing.type")}
                      <select
                        value={current.writingStyle ?? "lines"}
                        onChange={(e) =>
                          patch({
                            writingStyle: e.target.value as "lines" | "grid",
                          })
                        }
                      >
                        <option value="lines">{t("writing.lines")}</option>
                        <option value="grid">{t("writing.grid")}</option>
                      </select>
                    </label>
                    <label>
                      {t("writing.spacing")}
                      <input
                        type="number"
                        min="4"
                        max="100"
                        value={current.spacing ?? 20}
                        onChange={(e) =>
                          patch({
                            spacing: Math.max(
                              4,
                              Math.min(100, +e.target.value),
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      {t("writing.stroke")}
                      <input
                        type="number"
                        min="0.25"
                        max="4"
                        step="0.25"
                        value={current.strokeWidth ?? 0.75}
                        onChange={(e) =>
                          patch({
                            strokeWidth: Math.max(
                              0.25,
                              Math.min(4, +e.target.value),
                            ),
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {current.kind !== "image" && (
                  <label>
                    {t("editor.color")}
                    <input
                      type="color"
                      value={current.color}
                      onChange={(e) => patch({ color: e.target.value })}
                    />
                  </label>
                )}
                <div className="rect-inputs">
                  {(["x", "y", "width", "height", "rotation"] as const).map(
                    (key, i) => (
                      <label key={key}>
                        {
                          [
                            t("editor.x"),
                            t("editor.y"),
                            t("editor.width"),
                            t("editor.height"),
                            t("editor.rotation"),
                          ][i]
                        }
                        <input
                          type="number"
                          value={Math.round((active || current)[key])}
                          min={
                            key === "rotation"
                              ? -180
                              : key === "width" || key === "height"
                                ? 3
                                : 0
                          }
                          max={
                            key === "rotation"
                              ? 180
                              : key === "x" || key === "width"
                                ? 740
                                : 1050
                          }
                          onChange={(e) => {
                            const min =
                              key === "rotation"
                                ? -180
                                : key === "width" || key === "height"
                                  ? 3
                                  : 0;
                            const max =
                              key === "rotation"
                                ? 180
                                : key === "x" || key === "width"
                                  ? 740
                                  : 1050;
                            patch({
                              [key]: Math.max(
                                min,
                                Math.min(max, +e.target.value),
                              ),
                            });
                          }}
                        />
                      </label>
                    ),
                  )}
                </div>
                <div className="designer-layer-actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      const copy = {
                        ...current,
                        id: crypto.randomUUID(),
                        x: Math.min(740 - current.width, current.x + 15),
                        y: Math.min(1050 - current.height, current.y + 15),
                      };
                      commit({
                        ...design,
                        elements: [...design.elements, copy],
                      });
                      select(copy.id);
                    }}
                  >
                    {t("action.duplicate")}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      commit({
                        ...design,
                        elements: design.elements.filter(
                          (e) => e.id !== selected,
                        ),
                      });
                      select(null);
                    }}
                  >
                    {t("action.delete")}
                  </button>
                  <button
                    disabled={design.elements.at(-1)?.id === selected}
                    onClick={() => moveLayer(1)}
                  >
                    {t("editor.forward")}
                  </button>
                  <button
                    disabled={design.elements[0]?.id === selected}
                    onClick={() => moveLayer(-1)}
                  >
                    {t("editor.backward")}
                  </button>
                </div>
              </>
            ) : (
              <p className="hint">{t("editor.selectHint")}</p>
            )}
            <h2>{t("editor.layers")}</h2>
            <div className="designer-layers">
              {[...design.elements]
                .filter((e) => !e.calendar || design.showCalendar)
                .reverse()
                .map((e) => (
                  <button
                    key={e.id}
                    aria-pressed={selected === e.id}
                    onClick={() => select(e.id)}
                  >
                    {designElementLabel(e)}
                    {!e.label && !e.calendar && e.kind === "text"
                      ? ` · ${e.text.slice(0, 28)}`
                      : ""}
                  </button>
                ))}
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
