// Resolves a design-system CSS variable (stored as "H S% L%") into a concrete
// color string usable by libraries that need real fill values (SVG, canvas).
// Keeps the app themeable: colors still come from index.css tokens.

export function resolveHslVar(variable: string, alpha = 1): string {
  const fallback = "0 0% 50%";
  let triple = fallback;
  try {
    if (typeof window !== "undefined") {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue(variable)
        .trim();
      if (v) triple = v;
    }
  } catch {
    /* ignore */
  }
  return alpha >= 1 ? `hsl(${triple})` : `hsl(${triple} / ${alpha})`;
}
