export type TaskCategory = "work" | "personal" | "learning";

export function normalizeCategory(c: string): TaskCategory {
  if (c === "work" || c === "personal" || c === "learning") return c;
  return "personal";
}

export function categoryLabel(c: string): string {
  switch (normalizeCategory(c)) {
    case "work":
      return "Робота";
    case "learning":
      return "Навчання";
    default:
      return "Особисте";
  }
}

export function categoryShort(c: string): string {
  switch (normalizeCategory(c)) {
    case "work":
      return "💼";
    case "learning":
      return "📚";
    default:
      return "🏠";
  }
}
