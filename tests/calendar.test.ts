import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  pages,
  validate,
  svg,
  validProject,
  type Layout,
} from "../src/planner.ts";
test("leap year includes February 29 exactly once", () => {
  const p = {
    ...defaults(),
    start: "2024-01-01",
    end: "2024-12-31",
    layout: "day" as Layout,
  };
  const days = pages(p).flatMap((x) => x.days);
  assert.equal(days.length, 366);
  assert.equal(days.filter((d) => d === "2024-02-29").length, 1);
});
for (const layout of ["day", "week", "spread"] as Layout[])
  test(`${layout}: dates complete, unique, duplex covers`, () => {
    const p = { ...defaults(), start: "2026-12-29", end: "2027-01-12", layout };
    const all = pages(p);
    const days = all
      .flatMap((x) => x.days)
      .filter((d) => d >= p.start && d <= p.end);
    assert.equal(days.length, 15);
    assert.equal(new Set(days).size, 15);
    assert.equal(all.length % 2, 0);
    assert.equal(all[0].kind, "front");
    assert.equal(all.at(-1)?.kind, "back");
    if (layout === "spread") {
      assert.equal(all[1].side, "left");
      assert.equal(all[2].side, "right");
    }
  });
test("rejects invalid, reversed and excessive intervals", () => {
  for (const [start, end] of [
    ["2025-02-29", "2025-03-01"],
    ["2026-02-01", "2026-01-01"],
    ["2020-01-01", "2030-01-01"],
    ["", "2026-01-01"],
  ])
    assert.ok(validate({ ...defaults(), start, end }));
});
test("backup validation and SVG escaping", () => {
  const p = defaults();
  assert.ok(validProject(p));
  assert.ok(
    !validProject({
      ...p,
      assets: { front: { name: "bad", data: "https://example.com" } },
    }),
  );
  p.title = '<script> & "';
  assert.ok(svg(p, pages(p)[0]).includes("&lt;script&gt;"));
  assert.ok(!validProject({ ...p, margin: Infinity }));
});
test("month boundary splits the week and leaves the other month blank", () => {
  for (const layout of ["week", "spread"] as Layout[]) {
    const p = { ...defaults(), start: "2028-02-28", end: "2028-03-05", layout };
    const inside = pages(p).filter((p) => p.kind === "inside");
    const feb = inside
      .filter((p) => p.month === "2028-02")
      .flatMap((p) => p.days);
    const mar = inside
      .filter((p) => p.month === "2028-03")
      .flatMap((p) => p.days);
    assert.deepEqual(feb, ["2028-02-28", "2028-02-29", "", "", "", "", ""]);
    assert.deepEqual(mar, [
      "",
      "",
      "2028-03-01",
      "2028-03-02",
      "2028-03-03",
      "2028-03-04",
      "2028-03-05",
    ]);
    assert.ok(!svg(p, inside[0]).includes("marzo"));
  }
});

test("four-day left page preserves dates and month cutoffs, with compatible backups", () => {
  const p = {
    ...defaults(),
    layout: "spread" as const,
    spreadSplit: 4 as const,
    start: "2028-03-06",
    end: "2028-03-12",
  };
  const interior = pages(p).filter((p) => p.kind === "inside");
  assert.deepEqual(interior[0].days, [
    "2028-03-06",
    "2028-03-07",
    "2028-03-08",
    "2028-03-09",
  ]);
  assert.deepEqual(interior[1].days, [
    "2028-03-10",
    "2028-03-11",
    "2028-03-12",
  ]);
  const boundary = pages({
    ...p,
    start: "2028-02-28",
    end: "2028-03-05",
  }).filter((p) => p.kind === "inside");
  assert.deepEqual(
    boundary.map((p) => p.days),
    [
      ["2028-02-28", "2028-02-29", "", ""],
      ["", "", ""],
      ["", "", "2028-03-01", "2028-03-02"],
      ["2028-03-03", "2028-03-04", "2028-03-05"],
    ],
  );
  assert.ok(validProject(JSON.parse(JSON.stringify(p))));
  const legacy = { ...p };
  delete legacy.spreadSplit;
  assert.ok(validProject(legacy));
  assert.equal(pages(legacy)[1].days.length, 3);
  assert.ok(!validProject({ ...p, spreadSplit: 5 }));
});

test("template replaces dates in place without a second calendar and validates mapping", async () => {
  const { renderTemplate, validTemplate, templateIssue } =
    await import("../src/template.ts");
  const field = {
    x: 70,
    y: 100,
    width: 40,
    height: 25,
    fontSize: 16,
    color: "#777777",
    background: "#ffffff",
    font: "serif" as const,
    align: "left" as const,
  };
  const t = {
    fields: [
      { ...field, kind: "month" as const },
      { ...field, kind: "number" as const, weekday: 3 },
      { ...field, kind: "weekday" as const, weekday: 3 },
    ],
    days: [{ weekday: 3, area: { x: 60, y: 95, width: 600, height: 220 } }],
  };
  assert.ok(validTemplate(t));
  assert.ok(
    !validTemplate({ ...t, fields: [{ ...t.fields[0], x: Infinity }] }),
  );
  const p = {
    ...defaults(),
    start: "2026-10-01",
    end: "2026-10-04",
    spreadSplit: 4 as const,
  };
  const content = renderTemplate(p, pages(p)[1], t, false);
  assert.ok(content.includes("octubre</text>"));
  assert.ok(content.includes(">1</text>"));
  assert.ok(content.includes("Jueves</text>"));
  assert.ok(!content.includes("<line"));
  const asset = {
    name: "left.png",
    data: "data:image/png;base64,aA==",
    template: t,
  };
  assert.ok(
    templateIssue({ ...p, assets: { inside: asset } }).includes("Lunes"),
  );
  const blank = renderTemplate(
    { ...p, start: "2026-09-28", end: "2026-09-30" },
    {
      ...pages(p)[1],
      days: ["2026-09-28", "2026-09-29", "2026-09-30", ""],
      month: "2026-09",
    },
    t,
    false,
  );
  assert.ok(!blank.includes("Jueves</text>"));
});
