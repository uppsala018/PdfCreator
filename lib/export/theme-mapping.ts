export type ExportTheme = "clean-minimal" | "dark-cinematic" | "luxury-black-gold"

export function normalizeExportTheme(value: unknown, fallback: ExportTheme = "luxury-black-gold"): ExportTheme {
  if (value === "clean-minimal" || value === "dark-cinematic" || value === "luxury-black-gold") {
    return value
  }
  return fallback
}

export function toComposerTheme(theme: ExportTheme): "default" | "black_gold" {
  if (theme === "clean-minimal") return "default"
  return "black_gold"
}

export function exportThemeLabel(theme: ExportTheme): string {
  switch (theme) {
    case "clean-minimal":
      return "Clean Minimal"
    case "dark-cinematic":
      return "Dark Cinematic"
    case "luxury-black-gold":
      return "Luxury Black/Gold"
  }
}
