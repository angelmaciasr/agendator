import { useEffect, useState } from "react";
import { del } from "idb-keyval";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  FileImage,
  Menu,
  X,
} from "lucide-react";
import {
  defaults,
  pages,
  svg,
  validate,
  format,
  type Project,
  type Asset,
} from "./planner";
import { exportPDF } from "./export";
import "./App.css";
import TemplateEditor from "./TemplateEditor";
import { templateIssue, type Template } from "./template";
const steps = ["Calendario", "Diseños", "Impresión"];
function App() {
  const [view, setView] = useState<"single" | "double">("single");
  const [project, update] = useState<Project>(defaults);
  const [step, setStep] = useState(0),
    [index, setIndex] = useState(1),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [mobileOpen, setMobileOpen] = useState(false);
  const [detecting, setDetecting] = useState("");
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => {
    // Remove the project saved by earlier versions; never restore or persist projects.
    void del("agendator-project").catch(() => {});
  }, []);
  function createAnother() {
    update(defaults());
    setStep(0);
    setIndex(1);
    setView("single");
    setEditing(null);
    setError("");
    setProgress(0);
    setMobileOpen(true);
  }
  const change = <K extends keyof Project>(k: K, v: Project[K]) =>
    update((p) => ({ ...p, [k]: v }));
  const all = pages(project),
    actualIndex = Math.min(index, Math.max(0, all.length - 1)),
    page = all[actualIndex],
    dateError = validate(project);
  const mappingError = templateIssue(project);
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
  const go = (n: number) => {
    setIndex(n);
  };
  async function upload(file: File | undefined, target: string) {
    if (!file) return;
    setError("");
    setDetecting("Abriendo imagen…");
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
      if (
        target === "inside" ||
        target === "right" ||
        (target === "override" && page?.kind === "inside")
      ) {
        setDetecting("Buscando las fechas de la plantilla…");
        try {
          const { detectTemplate } = await import("./detect-template");
          asset.template = await detectTemplate(data, setDetecting);
        } catch {
          asset.template = { fields: [], days: [] };
        }
        if (!asset.template.days.length)
          setError(
            "No se han reconocido los días. Abre Ajustar fechas y marca sus campos y zonas en la imagen.",
          );
      }
      if (target === "inside" && asset.template?.days.length === 7)
        change("layout", "week");
      if (target === "inside" && asset.template?.days.length === 1)
        change("layout", "day");
      if (target === "override" && page)
        update((p) => ({
          ...p,
          overrides: { ...p.overrides, [page.id]: asset },
        }));
      else
        update((p) => ({
          ...p,
          assets: { ...p.assets, [target]: asset },
          ...(asset.template &&
          ((target === "inside" &&
            asset.template.days.length === 4 &&
            asset.template.days.every((d) => d.weekday < 4)) ||
            (target === "right" &&
              Math.min(...asset.template.days.map((d) => d.weekday)) === 4))
            ? { layout: "spread", spreadSplit: 4 }
            : {}),
        }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir la imagen.");
    } finally {
      setDetecting("");
    }
  }
  async function generate() {
    setBusy(true);
    setProgress(0);
    setError("");
    try {
      await exportPDF(project, false, setProgress);
    } catch (e) {
      setError(
        `No se pudo crear el PDF. ${e instanceof Error ? e.message : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function loadExamples() {
    setLoadingExamples(true);
    try {
      for (const [target, name] of [
        ["inside", "izquierda"],
        ["right", "derecha"],
      ]) {
        const response = await fetch(
          `${import.meta.env.BASE_URL}templates/semana-${name}.png`,
        );
        if (!response.ok) {
          setError("No se pudo cargar la plantilla de ejemplo.");
          return;
        }
        await upload(
          new File([await response.blob()], `semana-${name}.png`, {
            type: "image/png",
          }),
          target,
        );
      }
      setView("double");
      go(1);
    } finally {
      setLoadingExamples(false);
    }
  }
  const editingAsset =
    editing === "override" && page
      ? project.overrides[page.id]
      : project.assets[editing as keyof Project["assets"]];
  function saveTemplate(template: Template) {
    if (!editing || !editingAsset) return;
    if (editing === "override" && page)
      change("overrides", {
        ...project.overrides,
        [page.id]: { ...editingAsset, template },
      });
    else
      change("assets", {
        ...project.assets,
        [editing]: { ...editingAsset, template },
      });
  }
  const assetInput = (
    target: "front" | "back" | "inside" | "right",
    title: string,
  ) => (
    <div className="asset-upload" key={target}>
      <div className="asset-row">
        <label className="upload">
          <FileImage size={21} />
          <span>
            <strong>{title}</strong>
            <small>{project.assets[target]?.name || "Elegir imagen"}</small>
          </span>
          <input
            aria-label={title}
            disabled={!!detecting || loadingExamples}
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
      {project.assets[target]?.template && (
        <div className="template-info">
          <span>
            {project.assets[target]!.template!.days.length} días ·{" "}
            {project.assets[target]!.template!.fields.length} campos
          </span>
          <button onClick={() => setEditing(target)}>Ajustar fechas</button>
        </div>
      )}
    </div>
  );
  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <BookOpen size={25} />
          <span>agendator</span>
        </div>
        <div className="header-actions">
          <button
            className="secondary"
            disabled={busy || !!detecting || loadingExamples}
            onClick={createAnother}
          >
            Crear otra
          </button>
          <button
            className="primary export-header"
            onClick={generate}
            disabled={busy || !!dateError || !!detecting || !!mappingError}
          >
            <Download size={17} />
            {busy ? `${progress}%` : "Exportar PDF"}
          </button>
        </div>
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
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Cerrar error">
            <X size={16} />
          </button>
        </div>
      )}
      {mappingError && !detecting && (
        <div className="detection-status" role="status">
          {mappingError}
        </div>
      )}
      {detecting && (
        <div className="detection-status" role="status">
          {detecting}
        </div>
      )}
      <div className="workspace">
        <aside className={mobileOpen ? "sidebar open" : "sidebar"}>
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
                        change("spreadSplit", Number(e.target.value) as 3 | 4);
                      }}
                    >
                      <option value={3}>
                        Lunes–miércoles / jueves–domingo
                      </option>
                      <option value={4}>Lunes–jueves / viernes–domingo</option>
                    </select>
                  </label>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={project.monthlyOverview ?? false}
                    onChange={(e) => {
                      change("monthlyOverview", e.target.checked);
                      go(1);
                    }}
                  />
                  Añadir vista mensual al inicio de cada mes
                </label>
                {project.monthlyOverview && (
                  <p className="hint">
                    Una página con el calendario completo de cada mes, incluido
                    el primero. En semanas de dos caras se añade una cara en
                    blanco para mantener las parejas.
                  </p>
                )}
                <p className="hint">
                  Semanas de lunes a domingo, cortadas al terminar cada mes. Los
                  días del otro mes quedan en blanco.
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
                  Sube una plantilla que ya tenga el diseño y los días.
                  Detectamos las fechas para sustituirlas en su sitio durante
                  todo el calendario.
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
                  PNG, JPG o WebP · hasta 15 MB. Las plantillas se ajustan al
                  papel completo. Usa imágenes con la proporción del papel.
                </p>
                <button
                  className="secondary"
                  disabled={!!detecting || loadingExamples}
                  onClick={() => {
                    void loadExamples().catch(() => {
                      setDetecting("");
                      setError("No se pudieron cargar las plantillas.");
                    });
                  }}
                >
                  Cargar las dos plantillas de ejemplo
                </button>
                <p className="hint">
                  Revisa las posiciones en «Ajustar fechas». Se conserva todo el
                  diseño: líneas, recuadros, Importante y Notas. La detección se
                  hace en este navegador.
                </p>
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
                  El PDF incluye portada, interiores y contraportada en orden de
                  lectura.
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
                <button
                  className="primary next"
                  onClick={generate}
                  disabled={
                    busy || !!dateError || !!detecting || !!mappingError
                  }
                >
                  <Download size={17} />
                  {busy ? `Generando… ${progress}%` : "Descargar PDF"}
                </button>
                {busy && <progress value={progress} max="100" />}
              </section>
            )}
          </>
          <p className="session-note">
            Al terminar, descarga el PDF o pulsa Crear otra. Si recargas o
            cierras esta página, se pierde el trabajo actual.
          </p>
        </aside>
        <main className="preview-area">
          <div className="preview-toolbar">
            <div>
              <strong>Vista previa</strong>
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
                        : p.kind === "monthly"
                          ? `Vista mensual · ${format(`${p.month}-01`, { month: "long", year: "numeric" })}`
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
                        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(project, visiblePage, false))}`}
                      />
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
          {page && page.kind !== "blank" && page.kind !== "monthly" && (
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
              {project.overrides[page.id]?.template && (
                <button onClick={() => setEditing("override")}>
                  Ajustar fechas
                </button>
              )}
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
      {editing && editingAsset && (
        <TemplateEditor
          asset={editingAsset}
          onChange={saveTemplate}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
export default App;
