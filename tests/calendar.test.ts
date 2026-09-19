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
test("month boundary preserves active dates and adds faint next-month dates", () => {
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
      trailingDays: [],
    },
    t,
    false,
  );
  assert.ok(!blank.includes("Jueves</text>"));
});

for (const layout of ["day", "week", "spread"] as Layout[])
  test(`${layout}: monthly overviews precede each month and preserve interior dates and duplex pairs`, () => {
    const p = {
      ...defaults(),
      layout,
      start: "2026-12-29",
      end: "2027-01-12",
      monthlyOverview: true,
    };
    const all = pages(p),
      monthly = all.filter((p) => p.kind === "monthly");
    assert.deepEqual(
      monthly.map((p) => p.month),
      ["2026-12", "2027-01"],
    );
    for (const m of monthly) {
      const idx = all.indexOf(m);
      const first = all.findIndex(
        (p) =>
          p.kind === "inside" && (p.month || p.days[0].slice(0, 7)) === m.month,
      );
      assert.ok(idx < first);
      assert.equal(first - idx, layout === "spread" ? 2 : 1);
    }
    const interior = all.filter((p) => p.kind === "inside");
    assert.deepEqual(
      interior,
      pages({ ...p, monthlyOverview: false }).filter(
        (p) => p.kind === "inside",
      ),
    );
    assert.equal(all.length % 2, 0);
    if (layout === "spread")
      for (let i = 0; i < all.length; i++) {
        if (all[i].side === "left") {
          assert.equal(i % 2, 1);
          assert.equal(all[i + 1].side, "right");
        }
      }
    assert.ok(validProject(p));
    assert.ok(!validProject({ ...p, monthlyOverview: "yes" }));
  });
test("monthly grid aligns weekdays and handles leap years and six-row months", async () => {
  const { monthCells } = await import("../src/planner.ts");
  const feb = monthCells("2024-02");
  assert.deepEqual(feb.slice(0, 4), ["", "", "", "2024-02-01"]);
  assert.equal(feb.filter((d) => d.startsWith("2024-02")).length, 29);
  assert.deepEqual(feb.slice(-3), ["2024-03-01", "2024-03-02", "2024-03-03"]);
  assert.ok(feb.includes("2024-02-29"));
  assert.equal(monthCells("2021-02").length, 28);
  assert.equal(monthCells("2026-03").length, 42);
  const p = {
    ...defaults(),
    start: "2024-02-10",
    end: "2024-02-20",
    monthlyOverview: true,
    assets: {
      inside: { name: "image.png", data: "data:image/png;base64,aA==" },
    },
  };
  const m = pages(p).find((p) => p.kind === "monthly")!;
  const output = svg(p, m);
  assert.ok(output.includes("febrero</text>"));
  assert.ok(output.includes("2024</text>"));
  assert.ok(output.includes("#c4c4c4"));
  assert.ok(output.includes('transform="translate(740 0) rotate(90)"'));
  assert.ok(output.includes('fill="#dddddd">1</text>'));
  assert.ok(!output.includes("<image"));
  assert.ok(
    !svg(p, { kind: "blank", days: [], id: "blank" }).includes("<image"),
  );
});

for (const layout of ["week", "spread"] as Layout[])
  for (const spreadSplit of [3, 4] as const)
    test(`${layout}/${spreadSplit}: next-month context crosses year boundaries without duplicating notes`, async () => {
      const { displayDays, renderTemplate } =
        await import("../src/template.ts");
      const p = {
        ...defaults(),
        layout,
        spreadSplit,
        start: "2026-12-28",
        end: "2027-01-03",
        notes: { "2027-01-01": "Solo en enero" },
      };
      const all = pages(p).filter((page) => page.kind === "inside");
      const december = all.filter((page) => page.month === "2026-12");
      assert.deepEqual(december.flatMap(displayDays), [
        "2026-12-28",
        "2026-12-29",
        "2026-12-30",
        "2026-12-31",
        "2027-01-01",
        "2027-01-02",
        "2027-01-03",
      ]);
      const context = december.find((page) =>
        displayDays(page).includes("2027-01-01"),
      )!;
      assert.ok(svg(p, context).includes('<g opacity="0.2">'));
      assert.ok(!svg(p, context).includes("Solo en enero"));
      const january = all.find((page) => page.days.includes("2027-01-01"))!;
      assert.ok(svg(p, january).includes("Solo en enero"));
      const field = {
        x: 50,
        y: 100,
        width: 120,
        height: 30,
        fontSize: 20,
        color: "#777777",
        background: "#ffffff",
        font: "serif" as const,
        align: "left" as const,
        weekday: 4,
      };
      const template = {
        fields: [
          { ...field, kind: "number" as const },
          { ...field, y: 140, kind: "weekday" as const },
        ],
        days: [
          { weekday: 4, area: { x: 50, y: 100, width: 600, height: 200 } },
        ],
      };
      for (const end of [p.end, "2026-12-31"]) {
        const output = renderTemplate({ ...p, end }, context, template, true);
        assert.ok(output.includes('opacity="0.2">1</text>'));
        assert.ok(output.includes('opacity="0.2">Viernes</text>'));
        assert.ok(output.includes('fill="#ffffff" opacity="0.8"'));
        assert.ok(!output.includes("Solo en enero"));
      }
    });

test("design guides measure rotated bounds and snap to page and nearby elements", async () => {
  const { bounds, snapElement } = await import("../src/design-geometry.ts");
  const e = {
    id: "a",
    kind: "rect" as const,
    x: 229,
    y: 454,
    width: 280,
    height: 140,
    rotation: 0,
    color: "#292524",
    fontSize: 36,
    font: "sans-serif" as const,
    text: "",
    src: "",
  };
  const centered = snapElement(e, [], 5);
  assert.equal(centered.element.x, 230);
  assert.equal(centered.element.y, 455);
  assert.deepEqual(centered.guides, { x: 370, y: 525 });
  assert.equal(snapElement({ ...e, x: 220 }, [], 2.5).element.x, 220);
  const rotated = bounds({ ...e, rotation: 90 });
  assert.ok(Math.abs(rotated.width - 140) < 0.001);
  assert.ok(Math.abs(rotated.height - 280) < 0.001);
  const aligned = snapElement(
    { ...e, x: 102, y: 200 },
    [{ ...e, id: "b", x: 100, y: 700 }],
    5,
  );
  assert.equal(aligned.element.x, 100);
  assert.equal(aligned.element.y, 200);
});

test("side resizing preserves the opposite edge and the other dimension", async () => {
  const { resizeElement } = await import("../src/design-geometry.ts");
  const e = {
    id: "a",
    kind: "rect" as const,
    x: 100,
    y: 150,
    width: 280,
    height: 140,
    rotation: 0,
    color: "#292524",
    fontSize: 36,
    font: "sans-serif" as const,
    text: "",
    src: "",
  };
  const left = resizeElement(e, "w", -40, 20);
  assert.equal(left.x, 60);
  assert.equal(left.width, 320);
  assert.equal(left.height, 140);
  assert.equal(left.y, 150);
  const top = resizeElement(e, "n", 30, -50);
  assert.equal(top.y, 100);
  assert.equal(top.height, 190);
  assert.equal(top.width, 280);
  const right = resizeElement(e, "e", 40, 20);
  assert.equal(right.width, 320);
  assert.equal(right.x, 100);
  assert.equal(right.height, 140);
  const bottom = resizeElement(e, "s", 40, 20);
  assert.equal(bottom.height, 160);
  assert.equal(bottom.width, 280);
  const corner = resizeElement(e, "se", 40, 20);
  assert.equal(corner.width, 320);
  assert.equal(corner.height, 160);
  assert.equal(corner.x, 100);
  assert.equal(corner.y, 150);
  const rotated = resizeElement({ ...e, rotation: 90 }, "e", 0, 40);
  assert.equal(rotated.width, 320);
  assert.equal(rotated.height, 140);
  assert.equal(rotated.x, 80);
  assert.equal(rotated.y, 170);
  const clamped = resizeElement(e, "w", 1000, 0);
  assert.equal(clamped.width, 8);
  assert.equal(clamped.x + clamped.width, e.x + e.width);
});

test("designer placeholders show the complete chosen split independently of real dates", async () => {
  const { calendarPlaceholder } = await import("../src/design-preview.ts");
  const decode = (s: string) => decodeURIComponent(s.slice(s.indexOf(",") + 1));
  for (const split of [3, 4] as const) {
    const p = {
      ...defaults(),
      start: "2026-09-09",
      end: "2026-09-09",
      spreadSplit: split,
    };
    const left = decode(calendarPlaceholder(p, "inside"));
    const right = decode(calendarPlaceholder(p, "right"));
    const names = [
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo",
    ];
    names.forEach((name, i) => {
      assert.equal(left.includes(`${name} XX`), i < split);
      assert.equal(right.includes(`${name} XX`), i >= split);
    });
    assert.ok(left.includes("Mes YYYY"));
    assert.ok(!left.includes("2026"));
    assert.ok(!left.includes('opacity="0.2"'));
  }
  const week = decode(
    calendarPlaceholder({ ...defaults(), layout: "week" }, "inside"),
  );
  assert.equal((week.match(/ XX<\/text>/g) || []).length, 7);
  const day = decode(
    calendarPlaceholder({ ...defaults(), layout: "day" }, "inside"),
  );
  assert.ok(day.includes("Día XX"));
  assert.equal((day.match(/ XX<\/text>/g) || []).length, 1);
});

test("editable calendar resolves dates at moved positions and hides missing weekdays", async () => {
  const { editableCalendarElements } = await import("../src/design-preview.ts");
  const p = {
    ...defaults(),
    start: "2026-09-09",
    end: "2026-09-13",
    spreadSplit: 4 as const,
  };
  const elements = editableCalendarElements(p, "inside").map((e) =>
    e.calendar?.kind === "number" ? { ...e, x: 400 } : e,
  );
  p.assets.inside = {
    name: "Editable",
    data: "data:image/png;base64,AA==",
    design: {
      background: "#ffffff",
      showCalendar: true,
      editableCalendar: true,
      elements,
    },
  };
  const page = pages(p).find((page) => page.kind === "inside")!;
  const result = svg(p, page, false);
  assert.ok(result.includes("translate(400"));
  assert.ok(result.includes(">9</text>"));
  assert.ok(result.includes(">2026</text>"));
  assert.ok(!result.includes(">Lunes</text>"));
  assert.ok(!result.includes("XX"));
  p.assets.inside.design!.showCalendar = false;
  assert.ok(!svg(p, page, false).includes("<text"));
});

test("writing areas render only explicit lines or grids and calendar creation adds no ruled background", async () => {
  const { editableCalendarElements } = await import("../src/design-preview.ts");
  const { renderDesign } = await import("../src/design.ts");
  const elements = editableCalendarElements(defaults(), "inside");
  assert.ok(!elements.some((e) => /^calendar-\d+-line-/.test(e.id)));
  const area = {
    id: "area",
    kind: "writing" as const,
    x: 10,
    y: 20,
    width: 100,
    height: 60,
    rotation: 0,
    color: "#a8a29e",
    fontSize: 17,
    font: "sans-serif" as const,
    text: "",
    src: "",
    spacing: 20,
    writingStyle: "lines" as const,
  };
  const design = {
    background: "#ffffff",
    showCalendar: false,
    elements: [area],
  };
  const lined = renderDesign(design);
  assert.ok(lined.includes('data-writing-area="lines"'));
  assert.ok(lined.includes("M 0 20 H 100"));
  assert.ok(!lined.includes(" V "));
  const grid = renderDesign({
    ...design,
    elements: [{ ...area, writingStyle: "grid" }],
  });
  assert.ok(grid.includes("M 20 0 V 60"));
  assert.ok(grid.includes('data-writing-area="grid"'));
});
