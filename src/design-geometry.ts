import type { DesignElement } from "./design";
export function bounds(e: DesignElement) {
  const angle = (e.rotation * Math.PI) / 180;
  const width =
    Math.abs(e.width * Math.cos(angle)) + Math.abs(e.height * Math.sin(angle));
  const height =
    Math.abs(e.width * Math.sin(angle)) + Math.abs(e.height * Math.cos(angle));
  return {
    x: e.x + (e.width - width) / 2,
    y: e.y + (e.height - height) / 2,
    width,
    height,
  };
}
export function snapElement(
  e: DesignElement,
  others: DesignElement[],
  tolerance: number,
) {
  const box = bounds(e);
  const axes = (["x", "y"] as const).map((axis) => {
    const size = axis === "x" ? "width" : "height";
    const end = axis === "x" ? 740 : 1050;
    const anchors = [
      box[axis],
      box[axis] + box[size] / 2,
      box[axis] + box[size],
    ];
    const targets = [
      0,
      end / 2,
      end,
      ...others
        .filter((o) => o.id !== e.id)
        .flatMap((o) => {
          const b = bounds(o);
          return [b[axis], b[axis] + b[size] / 2, b[axis] + b[size]];
        }),
    ];
    let delta = tolerance + 1;
    let guide: number | undefined;
    for (const target of targets)
      for (const anchor of anchors) {
        const distance = target - anchor;
        if (
          Math.abs(distance) <= tolerance &&
          Math.abs(distance) < Math.abs(delta)
        ) {
          delta = distance;
          guide = target;
        }
      }
    return { delta: guide === undefined ? 0 : delta, guide };
  });
  return {
    element: { ...e, x: e.x + axes[0].delta, y: e.y + axes[1].delta },
    guides: { x: axes[0].guide, y: axes[1].guide },
  };
}

export type ResizeHandle = "n" | "s" | "e" | "w" | "se";
export function resizeElement(
  e: DesignElement,
  handle: ResizeHandle,
  dx: number,
  dy: number,
): DesignElement {
  const angle = (e.rotation * Math.PI) / 180;
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const localX = dx * cos + dy * sin,
    localY = -dx * sin + dy * cos;
  const horizontal = handle.includes("e") ? 1 : handle === "w" ? -1 : 0;
  const vertical = handle.includes("s") ? 1 : handle === "n" ? -1 : 0;
  const width = horizontal
    ? Math.max(8, Math.min(740, e.width + horizontal * localX))
    : e.width;
  const height = vertical
    ? Math.max(3, Math.min(1050, e.height + vertical * localY))
    : e.height;
  const dw = width - e.width,
    dh = height - e.height;
  // Shift the centre so the opposite edge stays fixed, including rotated objects.
  const cx = (horizontal * dw) / 2,
    cy = (vertical * dh) / 2;
  return {
    ...e,
    width,
    height,
    x: e.x + cx * cos - cy * sin - dw / 2,
    y: e.y + cx * sin + cy * cos - dh / 2,
  };
}
