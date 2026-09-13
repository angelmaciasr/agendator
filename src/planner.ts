export type Layout = "day" | "week" | "spread";
export type Asset = { name: string; data: string };
export type Project = {
  version: 1;
  title: string;
  start: string;
  end: string;
  layout: Layout;
  spreadSplit?: 3 | 4;
  size: "A5" | "A4";
  color: string;
  margin: number;
  top: number;
  bottom: number;
  overlay: boolean;
  assets: Partial<Record<"front" | "back" | "inside" | "right", Asset>>;
  overrides: Record<string, Asset>;
  notes: Record<string, string>;
};
export type Page = {
  id: string;
  kind: "front" | "back" | "inside" | "blank";
  days: string[];
  side?: "left" | "right";
  month?: string;
};
export const today = () => new Date().toLocaleDateString("sv-SE");
export const defaults = (): Project => ({
  version: 1,
  title: "Mi agenda",
  start: `${new Date().getFullYear()}-01-01`,
  end: `${new Date().getFullYear()}-12-31`,
  layout: "spread",
  spreadSplit: 3,
  size: "A5",
  color: "#b45309",
  margin: 9,
  top: 15,
  bottom: 8,
  overlay: true,
  assets: {},
  overrides: {},
  notes: {},
});
export const date = (key: string) => new Date(`${key}T12:00:00Z`);
export const key = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => {
  const d = date(s);
  d.setUTCDate(d.getUTCDate() + n);
  return key(d);
};
export function validate(p: Project) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(p.start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(p.end) ||
    !Number.isFinite(+date(p.start)) ||
    !Number.isFinite(+date(p.end)) ||
    key(date(p.start)) !== p.start ||
    key(date(p.end)) !== p.end
  )
    return "Introduce fechas válidas.";
  if (p.end < p.start) return "La fecha final debe ser posterior a la inicial.";
  if (+date(p.end) - +date(p.start) > 731 * 86400000)
    return "Puedes crear hasta dos años de agenda a la vez.";
  return "";
}
export function pages(p: Project): Page[] {
  if (validate(p)) return [];
  const out: Page[] = [{ id: "front", kind: "front", days: [] }];
  if (p.layout === "day") {
    for (let d = p.start; d <= p.end; d = addDays(d, 1))
      out.push({ id: d, kind: "inside", days: [d] });
  } else {
    const monday = addDays(p.start, -((date(p.start).getUTCDay() + 6) % 7));
    for (let d = monday; d <= p.end; d = addDays(d, 7)) {
      const week = Array.from({ length: 7 }, (_, i) => addDays(d, i));
      const months = [
        ...new Set(
          week
            .filter((day) => day >= p.start && day <= p.end)
            .map((day) => day.slice(0, 7)),
        ),
      ];
      for (const month of months) {
        const days = week.map((day) => (day.startsWith(month) ? day : ""));
        if (p.layout === "week")
          out.push({ id: `week-${d}-${month}`, kind: "inside", days, month });
        else
          out.push(
            {
              id: `left-${d}-${month}`,
              kind: "inside",
              days: days.slice(0, p.spreadSplit ?? 3),
              side: "left",
              month,
            },
            {
              id: `right-${d}-${month}`,
              kind: "inside",
              days: days.slice(p.spreadSplit ?? 3),
              side: "right",
              month,
            },
          );
      }
    }
  }
  // Back cover is always an even PDF page for duplex printing.
  if (out.length % 2 === 0) out.push({ id: "blank", kind: "blank", days: [] });
  out.push({ id: "back", kind: "back", days: [] });
  return out;
}
export const assetFor = (p: Project, page: Page) =>
  p.overrides[page.id] ||
  p.assets[
    page.kind === "front"
      ? "front"
      : page.kind === "back"
        ? "back"
        : page.side === "right"
          ? "right"
          : "inside"
  ] ||
  (page.kind === "inside" ? p.assets.inside : undefined);
export const format = (s: string, opts: Intl.DateTimeFormatOptions) =>
  date(s).toLocaleDateString("es-ES", { ...opts, timeZone: "UTC" });
const esc = (s: string) =>
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
export function wrap(text: string, width: number): string[] {
  return text.split("\n").flatMap((paragraph) => {
    const lines: string[] = [];
    let line = "";
    for (const word of paragraph.split(" ")) {
      if ((line + " " + word).trim().length > width && line) {
        lines.push(line);
        line = "";
      }
      let rest = word;
      while (rest.length > width) {
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(rest.slice(0, width));
        rest = rest.slice(width);
      }
      line = (line + " " + rest).trim();
    }
    lines.push(line);
    return lines;
  });
}
export function dayBoxes(p: Project, page: Page) {
  const x = (p.margin / 100) * 740;
  const y = (p.top / 100) * 1050;
  const height =
    (1050 - y - (p.bottom / 100) * 1050) / Math.max(page.days.length, 1);
  return page.days.map((day, i) => ({
    day,
    x,
    y: y + i * height,
    width: 740 - 2 * x,
    height,
  }));
}
export function svg(p: Project, page: Page, includeNotes = true): string {
  const asset = assetFor(p, page);
  const text = (
    x: number,
    y: number,
    value: string,
    size = 14,
    color = "#292524",
    weight = 400,
  ) =>
    `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(value)}</text>`;
  let body = '<rect width="740" height="1050" fill="white"/>';
  if (asset)
    body += `<image href="${esc(asset.data)}" width="740" height="1050" preserveAspectRatio="xMidYMid slice"/>`;
  if (page.kind === "blank")
    return `<svg xmlns="http://www.w3.org/2000/svg" width="740" height="1050" viewBox="0 0 740 1050">${body}</svg>`;
  if (page.kind !== "inside" && !asset) {
    body += `<rect x="40" y="40" width="660" height="970" fill="none" stroke="${p.color}" stroke-width="2"/>`;
    if (page.kind === "front") {
      body += text(80, 150, "AGENDA", 18, p.color, 600);
      wrap(p.title, 24)
        .slice(0, 5)
        .forEach((line, i) => {
          body += text(80, 430 + i * 52, line, 42, p.color, 600);
        });
      body += text(
        80,
        820,
        `${format(p.start, { month: "long", year: "numeric" })} — ${format(p.end, { month: "long", year: "numeric" })}`,
        18,
      );
    } else body += text(80, 920, p.title.slice(0, 55), 20, p.color);
  }
  if (page.kind === "inside" && p.overlay) {
    body += text(
      (p.margin / 100) * 740,
      Math.max(27, (p.top / 100) * 1050 - 24),
      format(page.month ? `${page.month}-01` : page.days[0], {
        month: "long",
        year: "numeric",
      }),
      21,
      p.color,
      600,
    );
    for (const box of dayBoxes(p, page)) {
      if (!box.day) continue;
      const active = box.day >= p.start && box.day <= p.end;
      body += `<line x1="${box.x}" y1="${box.y}" x2="${box.x + box.width}" y2="${box.y}" stroke="${p.color}" stroke-width="1"/>`;
      body += text(
        box.x,
        box.y + 27,
        format(box.day, { weekday: "long", day: "numeric", month: "short" }),
        17,
        active ? p.color : "#777777",
        600,
      );
      const maxLines = Math.max(0, Math.floor((box.height - 50) / 20));
      const lines =
        includeNotes && active
          ? wrap(p.notes[box.day] || "", Math.floor(box.width / 8))
          : [];
      for (let i = 0; i < maxLines; i++) {
        const y = box.y + 52 + i * 20;
        body += `<line x1="${box.x}" y1="${y + 5}" x2="${box.x + box.width}" y2="${y + 5}" stroke="#e7e5e4" stroke-width="0.6"/>`;
        if (lines[i]) body += text(box.x + 2, y, lines[i], 14);
      }
      if (lines.length > maxLines && maxLines)
        body += text(box.x + box.width - 20, box.y + box.height - 9, "…", 16);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="740" height="1050" viewBox="0 0 740 1050">${body}</svg>`;
}
export function validProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const p = value as Project;
  const validAsset = (a: Asset) =>
    a &&
    typeof a.name === "string" &&
    typeof a.data === "string" &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a.data);
  return (
    p.version === 1 &&
    typeof p.title === "string" &&
    p.title.length <= 120 &&
    ["day", "week", "spread"].includes(p.layout) &&
    (p.spreadSplit === undefined ||
      p.spreadSplit === 3 ||
      p.spreadSplit === 4) &&
    ["A4", "A5"].includes(p.size) &&
    /^#[0-9a-fA-F]{6}$/.test(p.color) &&
    typeof p.overlay === "boolean" &&
    [p.margin, p.top, p.bottom].every(
      (n) => typeof n === "number" && n >= 5 && n <= 40,
    ) &&
    typeof p.start === "string" &&
    typeof p.end === "string" &&
    !validate(p) &&
    !!p.notes &&
    Object.entries(p.notes).every(
      ([d, s]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(d) &&
        typeof s === "string" &&
        s.length <= 20000,
    ) &&
    !!p.assets &&
    !!p.overrides &&
    [...Object.values(p.assets), ...Object.values(p.overrides)].every(
      validAsset,
    )
  );
}
