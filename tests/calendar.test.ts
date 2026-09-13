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
