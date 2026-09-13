import { useEffect, useRef, useState } from "react";
import { get, set } from "idb-keyval";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Settings2,
  PenLine,
  FileImage,
  Check,
  Menu,
  X,
} from "lucide-react";
import {
  defaults,
  pages,
  svg,
  validate,
  validProject,
  format,
  today,
  dayBoxes,
  type Project,
  type Asset,
} from "./planner";
import { download, exportPDF } from "./export";
import "./App.css";
const steps = ["Calendario", "Diseños", "Impresión"];
function App() {
  const [view, setView] = useState<"single" | "double">("single");
  const [project, update] = useState<Project>(defaults);
  const [storedProject, setStoredProject] = useState<Project | null>(null);
  const [loaded, setLoaded] = useState(false),
    [saved, setSaved] = useState("Cargando…");
  const [step, setStep] = useState(0),
    [mode, setMode] = useState("design"),
    [index, setIndex] = useState(1),
    [selected, select] = useState(""),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [includeNotes, setIncludeNotes] = useState(false),
    [mobileOpen, setMobileOpen] = useState(false);
  const restore = useRef<HTMLInputElement>(null);
  useEffect(() => {
    get("agendator-project")
      .then((p) => {
        if (validProject(p)) update(p);
        setSaved("Guardado en este navegador");
      })
      .catch(() => setSaved("No se pudo leer el almacenamiento"))
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      set("agendator-project", project)
        .then(() => {
          setStoredProject(project);
          setSaved("Guardado en este navegador");
        })
        .catch(() => {
          setStoredProject(project);
          setSaved("No se pudo guardar. Descarga una copia.");
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [project, loaded]);
  const change = <K extends keyof Project>(k: K, v: Project[K]) =>
    update((p) => ({ ...p, [k]: v }));
  const all = pages(project),
    actualIndex = Math.min(index, Math.max(0, all.length - 1)),
    page = all[actualIndex],
    dateError = validate(project);
  const spreadStart =
    actualIndex === 0
      ? 0
      : actualIndex % 2 === 0
        ? actualIndex - 1
        : actualIndex;
  const viewStart = view === "double" ? spreadStart : actualIndex;
  const visiblePages = all.slice(
    viewStart,
    viewStart + (view === "double" && viewStart > 0 ? 2 : 1),
  );
  const viewEnd = viewStart + visiblePages.length - 1;
  const activeDay =
    selected && page?.days.includes(selected)
      ? selected
      : page?.days.find((d) => d >= project.start && d <= project.end) || "";
  const go = (n: number) => {
    setIndex(n);
    select("");
  };
  async function upload(file: File | undefined, target: string) {
    if (!file) return;
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
        throw new Error("Elige una imagen PNG, JPG o WebP.");
      if (file.size > 15 * 1024 * 1024)
        throw new Error("La imagen debe ocupar menos de 15 MB.");
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const img = new Image();
      img.src = data;
      await img.decode();
      const asset: Asset = { name: file.name, data };
      if (target === "override" && page)
        update((p) => ({
          ...p,
          overrides: { ...p.overrides, [page.id]: asset },
        }));
      else update((p) => ({ ...p, assets: { ...p.assets, [target]: asset } }));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir la imagen.");
    }
  }
  async function generate() {
    setBusy(true);
    setProgress(0);
    setError("");
    try {
      await exportPDF(project, includeNotes, setProgress);
    } catch (e) {
      setError(
        `No se pudo crear el PDF. ${e instanceof Error ? e.message : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }
  const assetInput = (
    target: "front" | "back" | "inside" | "right",
    title: string,
  ) => (
    <div className="asset-row" key={target}>
      <label className="upload">
        <FileImage size={21} />
        <span>
          <strong>{title}</strong>
          <small>{project.assets[target]?.name || "Elegir imagen"}</small>
        </span>
        <input
          aria-label={title}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            void upload(e.target.files?.[0], target);
            e.target.value = "";
          }}
        />
        <Upload size={16} />
      </label>
      {project.assets[target] && (
        <button
          className="icon"
          aria-label={`Quitar ${title}`}
          onClick={() => {
            const assets = { ...project.assets };
            delete assets[target];
            change("assets", assets);
          }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
  if (!loaded) return <main className="loading">Abriendo tu agenda…</main>;
  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <BookOpen size={25} />
          <span>agendator</span>
        </div>
        <div className="mode-tabs">
          <button
            className={mode === "design" ? "active" : ""}
            onClick={() => setMode("design")}
          >
            <Settings2 size={17} />
            Crear agenda
          </button>
          <button
            className={mode === "write" ? "active" : ""}
            onClick={() => setMode("write")}
          >
            <PenLine size={17} />
            Mi agenda
          </button>
        </div>
        <button
          className="primary export-header"
          onClick={generate}
          disabled={busy || !!dateError}
        >
          <Download size={17} />
          {busy ? `${progress}%` : "Exportar PDF"}
        </button>
      </header>
      <div className="subheader">
        <button
          className="mobile-toggle icon"
          aria-label="Mostrar configuración"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Menu size={20} />
        </button>
        <span>{project.title}</span>
        <span className="save-status">
          <Check size={14} />
          {storedProject === project ? saved : "Guardando…"}
        </span>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Cerrar error">
            <X size={16} />
          </button>
        </div>
      )}
      <div className="workspace">
        <aside className={mobileOpen ? "sidebar open" : "sidebar"}>
          {mode === "design" ? (
            <>
              <nav className="steps" aria-label="Pasos del asistente">
                {steps.map((s, i) => (
                  <button
                    key={s}
                    className={step === i ? "active" : ""}
                    onClick={() => setStep(i)}
                  >
                    <span>{i + 1}</span>
                    {s}
                  </button>
                ))}
              </nav>
              {step === 0 && (
                <section>
                  <h1>Tu agenda, a tu medida</h1>
                  <p>Elige las fechas y cómo quieres repartir tus días.</p>
                  <label>
                    Nombre de la agenda
                    <input
                      value={project.title}
                      maxLength={120}
                      onChange={(e) => change("title", e.target.value)}
                    />
                  </label>
                  <div className="dates">
                    <label>
                      Desde
                      <input
                        type="date"
                        value={project.start}
                        onChange={(e) => {
                          change("start", e.target.value);
                          go(1);
                        }}
                      />
                    </label>
                    <label>
                      Hasta
                      <input
                        type="date"
                        value={project.end}
                        onChange={(e) => change("end", e.target.value)}
                      />
                    </label>
                  </div>
                  {dateError && (
                    <p role="alert" className="validation">
                      {dateError}
                    </p>
                  )}
                  <fieldset>
                    <legend>¿Cuánto ocupa cada página?</legend>
                    {(
                      [
                        {
                          value: "day",
                          title: "Un día por página",
                          detail: "Espacio para todos los detalles",
                          glyph: "▤",
                        },
                        {
                          value: "week",
                          title: "Una semana por página",
                          detail: "Los siete días de un vistazo",
                          glyph: "▥",
                        },
                        {
                          value: "spread",
                          title: "Una semana en dos caras",
                          detail:
                            (project.spreadSplit ?? 3) === 4
                              ? "Lunes–jueves · viernes–domingo"
                              : "Lunes–miércoles · jueves–domingo",
                          glyph: "▥ ▥",
                        },
                      ] as const
                    ).map((o) => (
                      <label
                        className={`layout-option ${project.layout === o.value ? "chosen" : ""}`}
                        key={o.value}
                      >
                        <input
                          type="radio"
                          name="layout"
                          checked={project.layout === o.value}
                          onChange={() => {
                            change("layout", o.value);
                            go(1);
                          }}
                        />
                        <span className="layout-glyph" aria-hidden="true">
                          {o.glyph}
                        </span>
                        <span>
                          <strong>{o.title}</strong>
                          <small>{o.detail}</small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  {project.layout === "spread" && (
                    <label>
                      Reparto de la semana
                      <select
                        value={project.spreadSplit ?? 3}
                        onChange={(e) => {
                          change(
                            "spreadSplit",
                            Number(e.target.value) as 3 | 4,
                          );
                          select("");
                        }}
                      >
                        <option value={3}>
                          Lunes–miércoles / jueves–domingo
                        </option>
                        <option value={4}>
                          Lunes–jueves / viernes–domingo
                        </option>
                      </select>
                    </label>
                  )}
                  <p className="hint">
                    Semanas de lunes a domingo, cortadas al terminar cada mes.
                    Los días del otro mes quedan en blanco.
                  </p>
                  <button
                    className="primary next"
                    disabled={!!dateError}
                    onClick={() => setStep(1)}
                  >
                    Continuar con los diseños
                    <ChevronRight size={17} />
                  </button>
                </section>
              )}
              {step === 1 && (
                <section>
                  <h1>Añade tus diseños</h1>
                  <p>
                    Sube las imágenes de tu agenda o utiliza el diseño que ves
                    aquí.
                  </p>
                  {assetInput("front", "Portada")}
                  {assetInput("back", "Contraportada")}
                  {assetInput(
                    "inside",
                    project.layout === "spread"
                      ? "Página izquierda"
                      : "Páginas interiores",
                  )}
                  {project.layout === "spread" &&
                    assetInput("right", "Página derecha")}
                  <p className="hint">
                    PNG, JPG o WebP · hasta 15 MB. La imagen llena la página y
                    se recorta si su proporción es distinta.
                  </p>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={project.overlay}
                      onChange={(e) => change("overlay", e.target.checked)}
                    />
                    Superponer fechas, líneas y notas
                  </label>
                  <label className="color-field">
                    Color del calendario
                    <input
                      type="color"
                      value={project.color}
                      onChange={(e) => change("color", e.target.value)}
                    />
                  </label>
                  {(["margin", "top", "bottom"] as const).map((k, i) => (
                    <label key={k}>
                      {
                        [
                          "Margen lateral",
                          "Inicio del calendario",
                          "Margen inferior",
                        ][i]
                      }
                      <span className="range-value">{project[k]}%</span>
                      <input
                        type="range"
                        min="5"
                        max={k === "top" ? "35" : "20"}
                        value={project[k]}
                        onChange={(e) => change(k, +e.target.value)}
                      />
                    </label>
                  ))}
                  <button className="primary next" onClick={() => setStep(2)}>
                    Preparar impresión
                    <ChevronRight size={17} />
                  </button>
                </section>
              )}
              {step === 2 && (
                <section>
                  <h1>Lista para imprimir</h1>
                  <p>
                    El PDF incluye portada, interiores y contraportada en orden
                    de lectura.
                  </p>
                  <label>
                    Tamaño del papel
                    <select
                      value={project.size}
                      onChange={(e) =>
                        change("size", e.target.value as Project["size"])
                      }
                    >
                      <option value="A5">A5 · 148 × 210 mm</option>
                      <option value="A4">A4 · 210 × 297 mm</option>
                    </select>
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={includeNotes}
                      onChange={(e) => setIncludeNotes(e.target.checked)}
                    />
                    Incluir mis notas en el PDF
                  </label>
                  <div className="print-summary">
                    <div>
                      <span>Páginas totales</span>
                      <strong>{all.length}</strong>
                    </div>
                    <div>
                      <span>Hojas a doble cara</span>
                      <strong>{all.length / 2}</strong>
                    </div>
                    <div>
                      <span>Resolución de exportación</span>
                      <strong>300 ppp</strong>
                    </div>
                  </div>
                  <p>
                    Imprime a tamaño real (100%), a doble cara y con giro por el
                    borde largo.
                  </p>
                  <p className="hint">
                    Se añade una página en blanco cuando hace falta para colocar
                    la contraportada al final de una hoja. Sin imposición de
                    cuadernillos ni sangrado profesional. Usa imágenes de alta
                    resolución.
                  </p>
                  <p className="hint">
                    Las notas que excedan el espacio visible se conservan en la
                    agenda digital; en el PDF se recortan con «…».
                  </p>
                  {!project.overlay && (
                    <p className="validation">
                      La superposición está desactivada: el PDF solo mostrará
                      tus diseños.
                    </p>
                  )}
                  <button
                    className="primary next"
                    onClick={generate}
                    disabled={busy || !!dateError}
                  >
                    <Download size={17} />
                    {busy ? `Generando… ${progress}%` : "Descargar PDF"}
                  </button>
                  {busy && <progress value={progress} max="100" />}
                </section>
              )}
            </>
          ) : (
            <section className="writing">
              <h1>Mi agenda</h1>
              <p>
                Selecciona un día y escribe. Tus notas se guardan
                automáticamente.
              </p>
              <label>
                Ir a una fecha
                <input
                  type="date"
                  min={project.start}
                  max={project.end}
                  value={activeDay}
                  onChange={(e) => {
                    const idx = all.findIndex((p) =>
                      p.days.includes(e.target.value),
                    );
                    if (idx >= 0) {
                      go(idx);
                      select(e.target.value);
                    }
                  }}
                />
              </label>
              <button
                className="secondary"
                onClick={() => {
                  const idx = all.findIndex((p) => p.days.includes(today()));
                  if (idx >= 0) {
                    go(idx);
                    select(today());
                  } else
                    setError(
                      "Hoy no está dentro de las fechas de esta agenda.",
                    );
                }}
              >
                Ir a hoy
              </button>
              <div className="day-selector">
                {page?.days
                  .filter((d) => d >= project.start && d <= project.end)
                  .map((d) => (
                    <button
                      key={d}
                      className={activeDay === d ? "active" : ""}
                      onClick={() => select(d)}
                    >
                      {format(d, { weekday: "short", day: "numeric" })}
                    </button>
                  ))}
              </div>
              {activeDay ? (
                <label>
                  {format(activeDay, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                  <textarea
                    aria-label="Notas del día"
                    placeholder="Planes, ideas, cosas por hacer…"
                    maxLength={20000}
                    value={project.notes[activeDay] || ""}
                    onChange={(e) =>
                      change("notes", {
                        ...project.notes,
                        [activeDay]: e.target.value,
                      })
                    }
                  />
                  <small>
                    {(project.notes[activeDay] || "").length.toLocaleString(
                      "es-ES",
                    )}{" "}
                    / 20.000 caracteres
                  </small>
                </label>
              ) : (
                <p>Abre una página interior para empezar a escribir.</p>
              )}
            </section>
          )}
          <div className="backup">
            <button
              onClick={() =>
                download(
                  new Blob([JSON.stringify(project)], {
                    type: "application/json",
                  }),
                  "mi-agenda.json",
                )
              }
            >
              <Download size={15} />
              Guardar copia
            </button>
            <button onClick={() => restore.current?.click()}>
              <Upload size={15} />
              Abrir copia
            </button>
            <input
              ref={restore}
              hidden
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  if (f.size > 150 * 1024 * 1024) throw new Error();
                  const value: unknown = JSON.parse(await f.text());
                  if (!validProject(value)) throw new Error();
                  update(value);
                  go(1);
                  setError("");
                } catch {
                  setError(
                    "Esta copia no es válida. Elige un JSON exportado por Agendator.",
                  );
                }
              }}
            />
            <p>
              Diseños y notas solo en este navegador. Guarda una copia para
              llevarlos a otro dispositivo.
            </p>
          </div>
        </aside>
        <main className="preview-area">
          <div className="preview-toolbar">
            <div>
              <strong>
                {mode === "design" ? "Vista previa" : "Tu agenda"}
              </strong>
              <span>
                {project.size} ·{" "}
                {project.layout === "day"
                  ? "Día por página"
                  : project.layout === "week"
                    ? "Semana por página"
                    : "Semana en dos caras"}
              </span>
            </div>
            <div className="preview-actions">
              <div
                className="view-toggle"
                role="group"
                aria-label="Páginas visibles"
              >
                <button
                  aria-pressed={view === "single"}
                  onClick={() => setView("single")}
                >
                  Una página
                </button>
                <button
                  aria-pressed={view === "double"}
                  onClick={() => setView("double")}
                >
                  Dos páginas
                </button>
              </div>
              <select
                aria-label="Ir a página"
                value={actualIndex}
                onChange={(e) => go(+e.target.value)}
              >
                {all.map((p, i) => (
                  <option key={p.id} value={i}>
                    {i + 1} ·{" "}
                    {p.kind === "front"
                      ? "Portada"
                      : p.kind === "back"
                        ? "Contraportada"
                        : p.kind === "blank"
                          ? "En blanco"
                          : format(p.days.find(Boolean) || `${p.month}-01`, {
                              day: "numeric",
                              month: "short",
                            }) +
                            (p.side === "right"
                              ? " · derecha"
                              : p.side === "left"
                                ? " · izquierda"
                                : "")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={`canvas ${view === "double" ? "double-view" : ""}`}>
            {page ? (
              visiblePages.map((visiblePage, offset) => {
                const pageIndex = viewStart + offset;
                return (
                  <div className="page-view" key={visiblePage.id}>
                    {view === "double" && (
                      <button
                        className="page-select"
                        aria-pressed={actualIndex === pageIndex}
                        onClick={() => go(pageIndex)}
                      >
                        Página {pageIndex + 1}
                      </button>
                    )}
                    <div className="paper">
                      <img
                        alt={`Vista previa de la página ${pageIndex + 1}`}
                        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(project, visiblePage))}`}
                      />
                      {mode === "write" &&
                        visiblePage.kind === "inside" &&
                        dayBoxes(project, visiblePage)
                          .filter(
                            (b) =>
                              b.day >= project.start && b.day <= project.end,
                          )
                          .map((b) => (
                            <button
                              className={`day-hit ${activeDay === b.day ? "selected" : ""}`}
                              key={b.day}
                              aria-label={`Escribir el ${b.day}`}
                              style={{
                                left: `${(b.x / 740) * 100}%`,
                                top: `${(b.y / 1050) * 100}%`,
                                width: `${(b.width / 740) * 100}%`,
                                height: `${(b.height / 1050) * 100}%`,
                              }}
                              onClick={() => {
                                setIndex(pageIndex);
                                select(b.day);
                                setMobileOpen(true);
                              }}
                            />
                          ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="empty">
                Configura un intervalo de fechas válido para ver tu agenda.
              </p>
            )}
          </div>
          <div className="page-controls">
            <button
              className="icon"
              disabled={viewStart === 0 || !page}
              onClick={() =>
                go(
                  view === "double"
                    ? Math.max(0, viewStart - 2)
                    : actualIndex - 1,
                )
              }
              aria-label="Página anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <span>
              {visiblePages.length === 2
                ? `Páginas ${viewStart + 1}–${viewEnd + 1}`
                : `Página ${page ? actualIndex + 1 : 0}`}{" "}
              de {all.length}
            </span>
            <button
              className="icon"
              disabled={viewEnd >= all.length - 1}
              onClick={() => go(viewEnd + 1)}
              aria-label="Página siguiente"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          {mode === "design" && page && page.kind !== "blank" && (
            <div className="page-override">
              <label>
                <Upload size={15} />
                Diseño solo para{" "}
                {view === "double"
                  ? `la página ${actualIndex + 1}`
                  : "esta página"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    void upload(e.target.files?.[0], "override");
                    e.target.value = "";
                  }}
                />
              </label>
              {project.overrides[page.id] && (
                <button
                  onClick={() => {
                    const o = { ...project.overrides };
                    delete o[page.id];
                    change("overrides", o);
                  }}
                >
                  Restablecer
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
export default App;
