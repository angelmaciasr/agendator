import { translator, weekdays as weekdayNames } from "./i18n";
import type { DesignElement } from "./design";
import { dayBoxes } from "./planner";
import { addDays, svg, type Project, type Page, type Asset } from "./planner";
import { renderTemplate } from "./template";
export type DesignTarget = "front" | "back" | "inside" | "right";
// A complete reference week avoids hiding weekdays at the chosen date boundaries.
export function placeholderContext(project: Project, target: DesignTarget) {
  const split = project.spreadSplit ?? 3;
  const weekdays =
    project.layout === "day"
      ? [0]
      : project.layout === "spread"
        ? Array.from(
            { length: target === "right" ? 7 - split : split },
            (_, i) => i + (target === "right" ? split : 0),
          )
        : [0, 1, 2, 3, 4, 5, 6];
  const page: Page = {
    id: "design-preview",
    kind: target === "front" || target === "back" ? target : "inside",
    days: weekdays.map((d) => addDays("2000-01-03", d)),
    side:
      project.layout === "spread"
        ? target === "right"
          ? "right"
          : "left"
        : undefined,
  };
  return {
    project: {
      ...project,
      start: "2000-01-03",
      end: "2000-01-09",
      overrides: {},
      notes: {},
    },
    page,
  };
}
export const svgImage = (value: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
export function calendarPlaceholder(
  project: Project,
  target: DesignTarget,
  asset?: Asset,
) {
  const context = placeholderContext(project, target);
  if (asset?.template)
    return svgImage(
      `<svg xmlns="http://www.w3.org/2000/svg" width="740" height="1050" viewBox="0 0 740 1050">${renderTemplate(context.project, context.page, asset.template, false, true)}</svg>`,
    );
  return svgImage(
    svg({ ...context.project, assets: {} }, context.page, false, true).replace(
      '<rect width="740" height="1050" fill="white"/>',
      "",
    ),
  );
}
export function assetThumbnail(project: Project, target: DesignTarget) {
  const asset = project.assets[target];
  if (!asset) return undefined;
  if (!asset.design) return asset.data;
  const context = placeholderContext(project, target);
  return svgImage(svg(context.project, context.page, false, true));
}

export function editableCalendarElements(
  project: Project,
  target: DesignTarget,
): DesignElement[] {
  const t = translator(project.language);
  const WEEKDAYS = weekdayNames(project.language ?? "es");
  const context = placeholderContext(project, target);
  const p = { ...context.project, assets: {} };
  const elements: DesignElement[] = [];
  const add = (
    id: string,
    label: string,
    kind: NonNullable<DesignElement["calendar"]>["kind"],
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    fontSize: number,
    color: string,
    weekday?: number,
  ) => {
    elements.push({
      id: `calendar-${id}`,
      label,
      kind: kind === "line" ? "line" : "text",
      x,
      y,
      width,
      height,
      text,
      fontSize,
      color,
      font: "sans-serif",
      rotation: 0,
      src: "",
      calendar: { kind, weekday, daily: p.layout === "day" },
    });
  };
  const x = p.margin * 7.4;
  const y = Math.max(27, p.top * 10.5 - 24) - 21;
  add(
    "month",
    t("calendar.month"),
    "month",
    x,
    y,
    160,
    30,
    t("calendar.month"),
    21,
    p.color,
  );
  add(
    "year",
    t("calendar.year"),
    "year",
    x + 170,
    y,
    100,
    30,
    t("calendar.yearPlaceholder"),
    21,
    p.color,
  );
  dayBoxes(p, context.page).forEach((box, index) => {
    const weekday = (new Date(`${box.day}T12:00:00Z`).getUTCDay() + 6) % 7;
    const name = p.layout === "day" ? t("calendar.day") : WEEKDAYS[weekday];
    add(
      `${index}-weekday`,
      name,
      "weekday",
      box.x,
      box.y + 8,
      115,
      25,
      name,
      17,
      p.color,
      weekday,
    );
    add(
      `${index}-number`,
      t("calendar.numberLabel", { day: name }),
      "number",
      box.x + 120,
      box.y + 8,
      45,
      25,
      t("calendar.numberPlaceholder"),
      17,
      p.color,
      weekday,
    );
    add(
      `${index}-divider`,
      t("calendar.dividerLabel", { day: name }),
      "line",
      box.x,
      box.y,
      box.width,
      1,
      "",
      17,
      p.color,
      weekday,
    );
  });
  return elements;
}
