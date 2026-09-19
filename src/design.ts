import type { Project, Page } from "./planner";
import { dateForWeekday, WEEKDAYS } from "./template";
import { escapeXml } from "./template";
export type DesignElement = {
  id: string;
  kind: "text" | "rect" | "ellipse" | "line" | "image" | "writing";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  fontSize: number;
  font: "sans-serif" | "serif";
  text: string;
  src: string;
  label?: string;
  writingStyle?: "lines" | "grid";
  spacing?: number;
  strokeWidth?: number;
  calendar?: {
    kind: "month" | "year" | "weekday" | "number" | "line";
    weekday?: number;
  };
};
export type Design = {
  background: string;
  showCalendar: boolean;
  elements: DesignElement[];
  editableCalendar?: boolean;
};
export function renderDesign(
  d: Design,
  context?: { project: Project; page: Page },
) {
  return (
    `<rect width="740" height="1050" fill="${escapeXml(d.background)}"/>` +
    d.elements
      .filter((e) => !e.calendar || d.showCalendar)
      .map((original) => {
        let e = original;
        let opacity = 1;
        if (e.calendar && context) {
          const { project: p, page } = context;
          const kind = e.calendar.kind;
          const header = kind === "month" || kind === "year";
          const day = header
            ? page.month
              ? `${page.month}-01`
              : page.days.find(Boolean)
            : dateForWeekday(page, e.calendar.weekday ?? 0);
          if (!day) return "";
          const trailing =
            !header && !!page.month && !day.startsWith(page.month);
          if (!header && !trailing && (day < p.start || day > p.end)) return "";
          if (trailing) opacity = 0.2;
          const date = new Date(`${day}T12:00:00Z`);
          const value =
            kind === "month"
              ? date.toLocaleDateString("es-ES", {
                  month: "long",
                  timeZone: "UTC",
                })
              : kind === "year"
                ? String(date.getUTCFullYear())
                : kind === "number"
                  ? String(date.getUTCDate())
                  : kind === "weekday"
                    ? WEEKDAYS[(date.getUTCDay() + 6) % 7]
                    : e.text;
          e = { ...e, text: value };
        }
        const color = escapeXml(e.color);
        let content = "";
        if (e.kind === "rect")
          content = `<rect width="${e.width}" height="${e.height}" fill="${color}"/>`;
        if (e.kind === "ellipse")
          content = `<ellipse cx="${e.width / 2}" cy="${e.height / 2}" rx="${e.width / 2}" ry="${e.height / 2}" fill="${color}"/>`;
        if (e.kind === "line")
          content = `<rect width="${e.width}" height="${e.height}" fill="${color}"/>`;
        if (e.kind === "writing") {
          const spacing = Math.max(4, Math.min(100, e.spacing ?? 20));
          const stroke = Math.max(0.25, Math.min(4, e.strokeWidth ?? 0.75));
          const lines: string[] = [];
          for (let y = spacing; y <= e.height - stroke / 2; y += spacing)
            lines.push(`M 0 ${y} H ${e.width}`);
          if (e.writingStyle === "grid")
            for (let x = spacing; x <= e.width - stroke / 2; x += spacing)
              lines.push(`M ${x} 0 V ${e.height}`);
          content = `<path data-writing-area="${e.writingStyle ?? "lines"}" d="${lines.join(" ")}" fill="none" stroke="${color}" stroke-width="${stroke}"/>`;
        }
        if (e.kind === "image")
          content = `<image href="${escapeXml(e.src)}" width="${e.width}" height="${e.height}" preserveAspectRatio="xMidYMid meet"/>`;
        if (e.kind === "text")
          content =
            `<svg width="${e.width}" height="${e.height}" overflow="hidden">` +
            e.text
              .split("\n")
              .map(
                (line, i) =>
                  `<text x="0" y="${e.fontSize + i * e.fontSize * 1.2}" font-family="${e.font}" font-size="${e.fontSize}" fill="${color}">${escapeXml(line)}</text>`,
              )
              .join("") +
            "</svg>";
        return `<g opacity="${opacity}" transform="translate(${e.x} ${e.y}) rotate(${e.rotation} ${e.width / 2} ${e.height / 2})">${content}</g>`;
      })
      .join("")
  );
}
export const designSvg = (d: Design) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="740" height="1050" viewBox="0 0 740 1050">${renderDesign(d)}</svg>`;
export async function designPng(d: Design) {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(designSvg(d))}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 1480;
  canvas.height = 2100;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo guardar el diseño.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
