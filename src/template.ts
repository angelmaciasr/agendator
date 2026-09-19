import type { Project, Page } from "./planner";
export type Rect = { x: number; y: number; width: number; height: number };
export type TemplateField = Rect & {
  kind: "month" | "number" | "weekday";
  weekday?: number;
  fontSize: number;
  color: string;
  background: string;
  font: "serif" | "sans-serif";
  align: "left" | "center";
};
export type TemplateDay = { weekday: number; area: Rect };
export type Template = { fields: TemplateField[]; days: TemplateDay[] };
export const WEEKDAYS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
export const templateFor = (p: Project, page: Page) => {
  const asset =
    p.overrides[page.id] ||
    (page.side === "right"
      ? p.assets.right || p.assets.inside
      : p.assets.inside);
  return page.kind === "inside" ? asset?.template : undefined;
};
export const displayDays = (page: Page) =>
  page.days.map((day, i) => day || page.trailingDays?.[i] || "");
export const dateForWeekday = (page: Page, weekday: number) =>
  page.days.length === 1 && !page.month
    ? page.days[0]
    : displayDays(page).find(
        (d) =>
          d && (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7 === weekday,
      );
export const escapeXml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function renderTemplate(
  p: Project,
  page: Page,
  t: Template,
  includeNotes: boolean,
  placeholders = false,
) {
  const rect = (r: Rect, color: string, opacity = 1) =>
    `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${color}" opacity="${opacity}"/>`;
  const isTrailing = (d: string) => !!page.month && !d.startsWith(page.month);
  let out = "";
  // Remove old dates first; preserve every other part of the uploaded artwork.
  for (const f of t.fields) out += rect(f, f.background);
  for (const day of t.days) {
    const d = dateForWeekday(page, day.weekday);
    if (d && isTrailing(d)) out += rect(day.area, "#ffffff", 0.8);
    else if (!d || d < p.start || d > p.end) out += rect(day.area, "#ffffff");
  }
  for (const [i, f] of t.fields.entries()) {
    const d =
      f.kind === "month"
        ? page.month
          ? `${page.month}-01`
          : page.days.find(Boolean)
        : dateForWeekday(page, f.weekday ?? 0);
    const trailing = !!d && f.kind !== "month" && isTrailing(d);
    if (!d || (f.kind !== "month" && !trailing && (d < p.start || d > p.end)))
      continue;
    const value = placeholders
      ? f.kind === "month"
        ? "Mes YYYY"
        : f.kind === "number"
          ? "XX"
          : p.layout === "day"
            ? "Día"
            : WEEKDAYS[f.weekday ?? 0]
      : f.kind === "month"
        ? new Date(`${d}T12:00:00Z`).toLocaleDateString("es-ES", {
            month: "long",
            timeZone: "UTC",
          })
        : f.kind === "number"
          ? String(Number(d.slice(-2)))
          : WEEKDAYS[(new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7];
    const x = f.align === "center" ? f.x + f.width / 2 : f.x + 2;
    out += `<clipPath id="field-${i}">${rect(f, "white")}</clipPath><text clip-path="url(#field-${i})" x="${x}" y="${f.y + f.height / 2}" dominant-baseline="central" text-anchor="${f.align === "center" ? "middle" : "start"}" font-family="${f.font}" font-size="${f.fontSize}" fill="${f.color}" opacity="${trailing ? 0.2 : 1}">${escapeXml(value)}</text>`;
  }
  if (includeNotes)
    for (const [i, day] of t.days.entries()) {
      const d = dateForWeekday(page, day.weekday);
      if (!d || isTrailing(d) || d < p.start || d > p.end || !p.notes[d])
        continue;
      const a = day.area,
        headerBottom = Math.max(
          a.y,
          ...t.fields
            .filter((f) => f.weekday === day.weekday)
            .map((f) => f.y + f.height),
        );
      const top = headerBottom + 18,
        size = 13,
        lineHeight = 18,
        cols = Math.max(1, Math.floor((a.width - 12) / 7));
      const lines = p.notes[d].split("\n").flatMap((line) => {
        const result: string[] = [];
        let remaining = line;
        while (remaining.length > cols) {
          let end = remaining.lastIndexOf(" ", cols);
          if (end < 1) end = cols;
          result.push(remaining.slice(0, end));
          remaining = remaining.slice(end).trimStart();
        }
        result.push(remaining);
        return result;
      });
      const count = Math.max(
        0,
        Math.floor((a.y + a.height - top - 8) / lineHeight),
      );
      out += `<clipPath id="note-${i}">${rect(a, "white")}</clipPath><g clip-path="url(#note-${i})">`;
      for (let n = 0; n < Math.min(count, lines.length); n++)
        out += `<text x="${a.x + 5}" y="${top + n * lineHeight}" font-family="sans-serif" font-size="${size}" fill="#555555">${escapeXml(lines[n])}${n === count - 1 && lines.length > count ? "…" : ""}</text>`;
      out += "</g>";
    }
  return out;
}
export function validTemplate(t: Template) {
  const rect = (r: Rect) =>
    !!r &&
    [r.x, r.y, r.width, r.height].every(Number.isFinite) &&
    r.x >= 0 &&
    r.y >= 0 &&
    r.width > 0 &&
    r.height > 0 &&
    r.x + r.width <= 741 &&
    r.y + r.height <= 1051;
  const weekday = (n: unknown) =>
    Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 6;
  return (
    !!t &&
    Array.isArray(t.fields) &&
    t.fields.length <= 30 &&
    Array.isArray(t.days) &&
    t.days.length <= 7 &&
    t.fields.every(
      (f) =>
        rect(f) &&
        ["month", "number", "weekday"].includes(f.kind) &&
        (f.kind === "month" || weekday(f.weekday)) &&
        ["serif", "sans-serif"].includes(f.font) &&
        ["left", "center"].includes(f.align) &&
        /^#[\da-f]{6}$/i.test(f.color) &&
        /^#[\da-f]{6}$/i.test(f.background) &&
        Number.isFinite(f.fontSize) &&
        f.fontSize >= 4 &&
        f.fontSize <= 100,
    ) &&
    t.days.every((d) => !!d && weekday(d.weekday) && rect(d.area))
  );
}

export function templateIssue(p: Project): string {
  if (!p.assets.inside?.template && !p.assets.right?.template) return "";
  const split = p.spreadSplit ?? 3;
  const groups =
    p.layout === "spread"
      ? [
          {
            asset: p.assets.inside,
            days: Array.from({ length: split }, (_, i) => i),
            name: "izquierda",
          },
          {
            asset: p.assets.right,
            days: Array.from({ length: 7 - split }, (_, i) => i + split),
            name: "derecha",
          },
        ]
      : [
          {
            asset: p.assets.inside,
            days: p.layout === "week" ? [0, 1, 2, 3, 4, 5, 6] : [],
            name: "interior",
          },
        ];
  for (const group of groups) {
    const t = group.asset?.template;
    if (group.asset?.design && !t) continue;
    if (!t) return `Sube y ajusta la plantilla ${group.name}.`;
    if (p.layout === "day") {
      if (!t.fields.some((f) => f.kind === "number") || !t.days.length)
        return "Marca el número y la zona del día en la plantilla interior.";
      continue;
    }
    for (const d of group.days)
      if (
        !t.days.some((day) => day.weekday === d) ||
        !t.fields.some((f) => f.kind === "number" && f.weekday === d) ||
        !t.fields.some((f) => f.kind === "weekday" && f.weekday === d)
      )
        return `Falta ajustar ${WEEKDAYS[d]} en la plantilla ${group.name}. Revisa el reparto de la semana o marca sus campos.`;
  }
  return "";
}
