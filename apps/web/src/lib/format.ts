export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(date));
}

export function formatDecisionLabel(value: "safe" | "caution" | "hold"): string {
  switch (value) {
    case "safe":
      return "Safe";
    case "caution":
      return "Caution";
    case "hold":
      return "Hold";
  }
}
