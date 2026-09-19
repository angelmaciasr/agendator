import { test } from "node:test";
import assert from "node:assert/strict";
import es from "../src/locales/es.js";
import en from "../src/locales/en.js";
import { translate, weekdays, months, setLanguage } from "../src/i18n.ts";
import {
  defaults,
  pages,
  svg,
  monthlySvg,
  validate,
  validProject,
} from "../src/planner.ts";
import {
  editableCalendarElements,
  assetThumbnail,
  calendarPlaceholder,
} from "../src/design-preview.ts";
import { recognizeWeekday, recognizeMonth } from "../src/detect-template.ts";
import {
  renderTemplate,
  validTemplate,
  type Template,
} from "../src/template.ts";
import { designElementLabel } from "../src/design.ts";

test("Spanish and English dictionaries have matching keys and interpolation parameters", () => {
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
  for (const key of Object.keys(es) as (keyof typeof es)[]) {
    assert.ok(es[key].trim() && en[key].trim(), key);
    assert.deepEqual(
      es[key].match(/\{\w+\}/g)?.sort(),
      en[key].match(/\{\w+\}/g)?.sort(),
      key,
    );
  }
  assert.equal(
    translate("preview.spreadCount", { start: 2, end: 3, total: 10 }, "en"),
    "Pages 2–3 of 10",
  );
});

test("project language drives basic, monthly and editable calendar output independently of UI language", () => {
  setLanguage("es");
  const p = {
    ...defaults("en"),
    start: "2026-09-07",
    end: "2026-09-13",
    title: "Mi texto personalizado",
  };
  const page = pages(p).find((page) => page.kind === "inside")!;
  assert.ok(svg(p, page).includes("September 2026"));
  assert.ok(svg(p, page).includes("Monday"));
  assert.ok(monthlySvg(p, "2026-09").includes("Sunday"));
  assert.ok(svg(p, pages(p)[0]).includes("Mi texto personalizado"));
  const elements = editableCalendarElements({ ...p, language: "es" }, "inside");
  p.assets.inside = {
    name: "Custom",
    data: "data:image/png;base64,AA==",
    design: {
      background: "#ffffff",
      editableCalendar: true,
      showCalendar: true,
      elements,
    },
  };
  const rendered = svg(p, page);
  assert.ok(rendered.includes(">September</text>"));
  assert.ok(rendered.includes(">Monday</text>"));
  assert.ok(!rendered.includes("Lunes"));
  assert.equal(
    designElementLabel(
      elements.find((e) => e.calendar?.kind === "number")!,
      "en",
    ),
    "Number · Monday",
  );
  const thumb = decodeURIComponent(assetThumbnail(p, "inside")!);
  assert.ok(thumb.includes(">Month</text>"));
  assert.ok(thumb.includes(">Monday</text>"));
  assert.ok(thumb.includes("YYYY"));
  assert.ok(
    decodeURIComponent(calendarPlaceholder(p, "right")).includes("Thursday XX"),
  );
  assert.equal(
    validate({ ...p, end: "2020-01-01" }),
    "The end date must be on or after the start date.",
  );
  assert.equal(validProject({ ...p, language: "fr" }), false);
});

test("OCR vocabulary recognizes days and months in both languages regardless of selected UI", () => {
  for (const lang of ["es", "en"] as const) {
    weekdays(lang).forEach((name, index) =>
      assert.equal(recognizeWeekday(name), index),
    );
    months(lang).forEach((name) => assert.equal(recognizeMonth(name), true));
  }
  assert.equal(recognizeWeekday("Miercoles"), 2);
  assert.equal(recognizeWeekday("Wednesdav"), 2);
  assert.equal(recognizeWeekday("Monday."), 0);
  assert.equal(recognizeWeekday("Notes"), -1);
  assert.equal(recognizeMonth("Month"), true);
  assert.equal(recognizeMonth("Mes"), true);
  assert.equal(recognizeMonth("Notes"), false);
});

test("template fields localize weekdays and months and replace detected years", () => {
  const field = {
    x: 40,
    y: 40,
    width: 140,
    height: 30,
    fontSize: 16,
    color: "#292524",
    background: "#ffffff",
    font: "serif" as const,
    align: "left" as const,
  };
  const template: Template = {
    fields: [
      { ...field, kind: "month" },
      { ...field, x: 200, kind: "year" },
      { ...field, y: 100, kind: "weekday", weekday: 0 },
      { ...field, x: 200, y: 100, kind: "number", weekday: 0 },
    ],
    days: [{ weekday: 0, area: { x: 40, y: 100, width: 600, height: 800 } }],
  };
  assert.ok(validTemplate(template));
  const p = {
    ...defaults("en"),
    layout: "day" as const,
    start: "2026-09-07",
    end: "2026-09-07",
  };
  const page = pages(p)[1];
  const english = renderTemplate(p, page, template, false);
  assert.ok(english.includes(">September</text>"));
  assert.ok(english.includes(">2026</text>"));
  assert.ok(english.includes(">Monday</text>"));
  const spanish = renderTemplate(
    { ...p, language: "es" },
    page,
    template,
    false,
  );
  assert.ok(spanish.includes(">septiembre</text>"));
  assert.ok(spanish.includes(">Lunes</text>"));
});
