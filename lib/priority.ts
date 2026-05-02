export type Priority = "high" | "medium" | "low";

export function priorityEmoji(priority: string): string {
  switch (priority) {
    case "high":
      return "🔴";
    case "medium":
      return "🟡";
    case "low":
      return "🟢";
    default:
      return "🟡";
  }
}

export function priorityRank(priority: string): number {
  switch (priority) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
      return 2;
    default:
      return 1;
  }
}

export function normalizePriority(p: string): Priority {
  if (p === "high" || p === "medium" || p === "low") return p;
  return "medium";
}
