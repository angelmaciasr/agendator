import { t, translate, getLanguage, setLanguage, type Language } from "./i18n";
import {
  assetThumbnail,
  editableCalendarElements,
  calendarPlaceholder,
  type DesignTarget,
} from "./design-preview";
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
import PageDesigner from "./PageDesigner";
import TemplateEditor from "./TemplateEditor";
import { templateIssue, type Template } from "./template";
function App() {
  const steps = [t("steps.calendar"), t("steps.templates"), t("steps.preview")];
  const [view, setView] = useState<"single" | "double">("single");
  const [project, update] = useState<Project>(() => defaults(getLanguage()));
  const [step, setStep] = useState(0),
    [index, setIndex] = useState(1),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [mobileOpen, setMobileOpen] = useState(false);
  const [detecting, setDetecting] = useState("");
  const [designing, setDesigning] = useState<string | null>(null);
  const [furthestStep, setFurthestStep] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => {
    // Remove the project saved by earlier versions; never restore or persist projects.
    void del("agendator-project").catch(() => {});
  }, []);
  useEffect(() => {
    document.documentElement.lang = project.language ?? "es";
    document.title = t("app.documentTitle");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", t("app.description"));
  }, [project.language]);
  function createAnother() {
    update(defaults(getLanguage()));
    setStep(0);
    setFurthestStep(0);
    setIndex(1);
    setView("single");
    setEditing(null);
    setDesigning(null);
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
  function navigateStep(next: number) {
    if (busy || detecting || (next > step && dateError)) return;
    setStep(next);
    setFurthestStep((previous) => Math.max(previous, next));
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  }
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
    setDetecting(t("upload.opening"));
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
        throw new Error(t("upload.formats"));
      if (file.size > 15 * 1024 * 1024) throw new Error(t("upload.tooLarge"));
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
        setDetecting(t("upload.detecting"));
        try {
          const { detectTemplate } = await import("./detect-template");
          asset.template = await detectTemplate(
            data,
            setDetecting,
            project.language,
          );
        } catch {
          asset.template = { fields: [], days: [] };
        }
        if (!asset.template.days.length) setError(t("upload.noDays"));
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
      setError(e instanceof Error ? e.message : t("upload.failed"));
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
        t("export.failed", { error: e instanceof Error ? e.message : "" }),
      );
    } finally {
      setBusy(false);
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
          {project.assets[target] ? (
            <img
              className="asset-thumbnail"
              src={assetThumbnail(project, target)}
              alt={t("asset.thumbnail", { title: title.toLowerCase() })}
            />
          ) : (
            <FileImage size={21} />
          )}
          <span>
            <strong>{title}</strong>
            <small>
              {project.assets[target]?.design
                ? t("asset.customDesign")
                : project.assets[target]?.name || t("upload.choose")}
            </small>
          </span>
          <input
            aria-label={title}
            disabled={!!detecting}
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
            aria-label={t("asset.remove", { title })}
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
      <button
        className="secondary create-design"
        disabled={!!detecting}
        onClick={() => setDesigning(target)}
      >
        {project.assets[target]
          ? t("asset.edit", { title: title.toLowerCase() })
          : t("asset.create", { title: title.toLowerCase() })}
      </button>
      {project.assets[target]?.template && (
        <div className="template-info">
          <span>
            {t("asset.fields", {
              days: project.assets[target]!.template!.days.length,
              fields: project.assets[target]!.template!.fields.length,
            })}
          </span>
          <button onClick={() => setEditing(target)}>
            {t("template.adjust")}
          </button>
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
          <label className="language-select">
            {t("app.language")}
            <select
              aria-label={t("app.language")}
              value={project.language ?? "es"}
              disabled={busy || !!detecting}
              onChange={(e) => {
                const language = e.target.value as Language;
                setLanguage(language);
                update((p) => ({
                  ...p,
                  language,
                  title:
                    p.title ===
                    translate("project.defaultTitle", {}, p.language ?? "es")
                      ? translate("project.defaultTitle", {}, language)
                      : p.title,
                }));
                setError("");
              }}
            >
              <option value="es">{t("app.spanish")}</option>
              <option value="en">{t("app.english")}</option>
            </select>
          </label>
          <button
            className="secondary"
            disabled={busy || !!detecting}
            onClick={createAnother}
          >
            {t("app.createAnother")}
          </button>
          {step === 2 && (
            <button
              className="primary export-header"
              onClick={generate}
              disabled={busy || !!dateError || !!detecting || !!mappingError}
            >
              <Download size={17} />
              {busy ? `${progress}%` : t("export.button")}
            </button>
          )}
        </div>
      </header>
      <div className="subheader">
        {step === 2 && (
          <button
            className="mobile-toggle icon"
            aria-label={t("app.showSettings")}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Menu size={20} />
          </button>
        )}
        <span>{project.title}</span>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label={t("app.closeError")}>
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
      <nav className="steps" aria-label={t("app.steps")}>
        {steps.map((s, i) => (
          <button
            key={s}
            className={step === i ? "active" : ""}
            aria-current={step === i ? "step" : undefined}
            disabled={
              busy ||
              !!detecting ||
              i > furthestStep ||
              (i > step && !!dateError)
            }
            onClick={() => navigateStep(i)}
          >
            <span>{i + 1}</span>
            {s}
          </button>
        ))}
      </nav>
      <div className={`workspace ${step < 2 ? "setup-workspace" : ""}`}>
        <aside
          className={mobileOpen ? "sidebar open" : "sidebar"}
          role={step < 2 ? "main" : undefined}
        >
          <>
            {step === 0 && (
              <section>
                <h1>{t("setup.title")}</h1>
                <p>{t("setup.description")}</p>
                <label>
                  {t("setup.name")}
                  <input
                    value={project.title}
                    maxLength={120}
                    onChange={(e) => change("title", e.target.value)}
                  />
                </label>
                <div className="dates">
                  <label>
                    {t("setup.from")}
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
                    {t("setup.to")}
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
                  <legend>{t("setup.layout")}</legend>
                  {(
                    [
                      {
                        value: "day",
                        title: t("layout.day"),
                        detail: t("layout.dayHint"),
                        glyph: "▤",
                      },
                      {
                        value: "week",
                        title: t("layout.week"),
                        detail: t("layout.weekHint"),
                        glyph: "▥",
                      },
                      {
                        value: "spread",
                        title: t("layout.spread"),
                        detail:
                          (project.spreadSplit ?? 3) === 4
                            ? t("layout.splitFourHint")
                            : t("layout.splitThreeHint"),
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
                    {t("layout.split")}
                    <select
                      value={project.spreadSplit ?? 3}
                      onChange={(e) => {
                        change("spreadSplit", Number(e.target.value) as 3 | 4);
                      }}
                    >
                      <option value={3}>{t("layout.splitThree")}</option>
                      <option value={4}>{t("layout.splitFour")}</option>
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
                  {t("setup.monthly")}
                </label>
                {project.monthlyOverview && (
                  <p className="hint">{t("setup.monthlyHint")}</p>
                )}
                <p className="hint">{t("setup.weeksHint")}</p>
                <button
                  className="primary next"
                  disabled={!!dateError}
                  onClick={() => navigateStep(1)}
                >
                  {t("setup.next")}
                  <ChevronRight size={17} />
                </button>
              </section>
            )}
            {step === 1 && (
              <section>
                <h1>{t("templates.title")}</h1>
                <p>{t("templates.description")}</p>
                {assetInput("front", t("asset.front"))}
                {assetInput("back", t("asset.back"))}
                {assetInput(
                  "inside",
                  project.layout === "spread"
                    ? t("asset.left")
                    : t("asset.inside"),
                )}
                {project.layout === "spread" &&
                  assetInput("right", t("asset.right"))}
                <p className="hint">{t("templates.formats")}</p>
                <p className="hint">{t("templates.adjustHint")}</p>
                <p className="hint">{t("templates.optional")}</p>
                <div className="step-actions">
                  <button
                    className="secondary"
                    disabled={!!detecting}
                    onClick={() => navigateStep(0)}
                  >
                    <ChevronLeft size={17} /> {t("action.back")}
                  </button>
                  <button
                    className="primary"
                    disabled={!!dateError || !!detecting}
                    onClick={() => navigateStep(2)}
                  >
                    {t("templates.next")}
                    <ChevronRight size={17} />
                  </button>
                </div>
              </section>
            )}
            {step === 2 && (
              <section>
                <h1>{t("print.title")}</h1>
                <p>{t("print.description")}</p>
                <label>
                  {t("print.paper")}
                  <select
                    value={project.size}
                    onChange={(e) =>
                      change("size", e.target.value as Project["size"])
                    }
                  >
                    <option value="A5">{t("print.a5")}</option>
                    <option value="A4">{t("print.a4")}</option>
                  </select>
                </label>
                <div className="print-summary">
                  <div>
                    <span>{t("print.pages")}</span>
                    <strong>{all.length}</strong>
                  </div>
                  <div>
                    <span>{t("print.sheets")}</span>
                    <strong>{all.length / 2}</strong>
                  </div>
                  <div>
                    <span>{t("print.resolution")}</span>
                    <strong>{t("print.dpi")}</strong>
                  </div>
                </div>
                <p>{t("print.instructions")}</p>
                <p className="hint">{t("print.hint")}</p>
                <button
                  className="primary next"
                  onClick={generate}
                  disabled={
                    busy || !!dateError || !!detecting || !!mappingError
                  }
                >
                  <Download size={17} />
                  {busy
                    ? t("export.progress", { progress })
                    : t("export.download")}
                </button>
                {busy && <progress value={progress} max="100" />}
                <button
                  className="secondary previous-step"
                  disabled={busy || !!detecting}
                  onClick={() => navigateStep(1)}
                >
                  <ChevronLeft size={17} /> {t("templates.back")}
                </button>
              </section>
            )}
          </>
          <p className="session-note">{t("app.sessionNote")}</p>
        </aside>
        {step === 2 && (
          <main className="preview-area">
            <div className="preview-toolbar">
              <div>
                <strong>{t("steps.preview")}</strong>
                <span>
                  {project.size} ·{" "}
                  {project.layout === "day"
                    ? t("layout.dayShort")
                    : project.layout === "week"
                      ? t("layout.weekShort")
                      : t("layout.spreadShort")}
                </span>
              </div>
              <div className="preview-actions">
                <div
                  className="view-toggle"
                  role="group"
                  aria-label={t("preview.visible")}
                >
                  <button
                    aria-pressed={view === "single"}
                    onClick={() => setView("single")}
                  >
                    {t("preview.single")}
                  </button>
                  <button
                    aria-pressed={view === "double"}
                    onClick={() => setView("double")}
                  >
                    {t("preview.double")}
                  </button>
                </div>
                <select
                  aria-label={t("preview.goTo")}
                  value={actualIndex}
                  onChange={(e) => go(+e.target.value)}
                >
                  {all.map((p, i) => (
                    <option key={p.id} value={i}>
                      {i + 1} ·{" "}
                      {p.kind === "front"
                        ? t("asset.front")
                        : p.kind === "back"
                          ? t("asset.back")
                          : p.kind === "monthly"
                            ? t("preview.monthly", {
                                date: format(`${p.month}-01`, {
                                  month: "long",
                                  year: "numeric",
                                }),
                              })
                            : p.kind === "blank"
                              ? t("preview.blank")
                              : format(
                                  p.days.find(Boolean) || `${p.month}-01`,
                                  {
                                    day: "numeric",
                                    month: "short",
                                  },
                                ) +
                                (p.side === "right"
                                  ? t("preview.rightSuffix")
                                  : p.side === "left"
                                    ? t("preview.leftSuffix")
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
                          {t("preview.page", { page: pageIndex + 1 })}
                        </button>
                      )}
                      <div className="paper">
                        <img
                          alt={t("preview.alt", { page: pageIndex + 1 })}
                          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(project, visiblePage, false))}`}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="empty">{t("preview.empty")}</p>
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
                aria-label={t("preview.previous")}
              >
                <ChevronLeft size={20} />
              </button>
              <span>
                {visiblePages.length === 2
                  ? t("preview.spreadCount", {
                      start: viewStart + 1,
                      end: viewEnd + 1,
                      total: all.length,
                    })
                  : t("preview.pageCount", {
                      page: page ? actualIndex + 1 : 0,
                      total: all.length,
                    })}
              </span>
              <button
                className="icon"
                disabled={viewEnd >= all.length - 1}
                onClick={() => go(viewEnd + 1)}
                aria-label={t("preview.next")}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            {page && page.kind !== "blank" && page.kind !== "monthly" && (
              <div className="page-override">
                <label>
                  <Upload size={15} />
                  {view === "double"
                    ? t("preview.overrideNumber", { page: actualIndex + 1 })
                    : t("preview.override")}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      void upload(e.target.files?.[0], "override");
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  disabled={!!detecting || busy}
                  onClick={() => setDesigning("override")}
                >
                  {t("preview.edit")}
                </button>
                {project.overrides[page.id]?.template && (
                  <button onClick={() => setEditing("override")}>
                    {t("template.adjust")}
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
                    {t("action.reset")}
                  </button>
                )}
              </div>
            )}
          </main>
        )}
      </div>
      {designing &&
        (() => {
          const target = designing as keyof Project["assets"];
          const sourcePage =
            designing === "override"
              ? page
              : all.find((p) =>
                  target === "front" || target === "back"
                    ? p.kind === target
                    : p.kind === "inside" &&
                      (target === "right"
                        ? p.side === "right"
                        : p.side !== "right"),
                );
          const sourceAsset =
            designing === "override" && page
              ? project.overrides[page.id] ||
                (page.kind === "front" || page.kind === "back"
                  ? project.assets[page.kind]
                  : page.side === "right"
                    ? project.assets.right || project.assets.inside
                    : project.assets.inside)
              : project.assets[target];
          const title =
            designing === "override"
              ? t("preview.page", { page: actualIndex + 1 })
              : {
                  front: t("asset.front"),
                  back: t("asset.back"),
                  inside: t("asset.inside"),
                  right: t("asset.right"),
                }[target];
          const interior = sourcePage?.kind === "inside";
          const calendarTarget: DesignTarget =
            designing === "override"
              ? sourcePage?.side === "right"
                ? "right"
                : "inside"
              : target;
          const calendar = interior
            ? calendarPlaceholder(project, calendarTarget, sourceAsset)
            : undefined;
          return (
            <PageDesigner
              title={title}
              asset={sourceAsset}
              interior={interior}
              calendar={calendar}
              calendarElements={
                interior && !sourceAsset?.template
                  ? editableCalendarElements(project, calendarTarget)
                  : undefined
              }
              onClose={() => setDesigning(null)}
              onSave={(asset) => {
                if (designing === "override" && page)
                  change("overrides", {
                    ...project.overrides,
                    [page.id]: asset,
                  });
                else change("assets", { ...project.assets, [target]: asset });
                setDesigning(null);
              }}
            />
          );
        })()}
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
