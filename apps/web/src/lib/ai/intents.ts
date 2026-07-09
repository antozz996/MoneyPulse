import type { CopilotIntent, IntentClassification } from "./types";

const INTENT_PATTERNS: Array<{
  intent: CopilotIntent;
  confidence: number;
  patterns: RegExp[];
}> = [
  {
    intent: "survival_plan",
    confidence: 0.95,
    patterns: [
      /\bpiano\b.*\bstipendio\b/i,
      /\bsurvival\b/i,
      /\bfino allo stipendio\b/i,
      /\buntil payday\b/i,
      /\bjusqu'au salaire\b/i,
      /\bhasta el sueldo\b/i
    ]
  },
  {
    intent: "affordability_check",
    confidence: 0.94,
    patterns: [
      /\bposso spendere\b/i,
      /\bcan i spend\b/i,
      /\bafford\b/i,
      /\bcomprare\b/i,
      /\bbuy\b/i,
      /\bpuis-je depenser\b/i,
      /\bpuis-je dépenser\b/i,
      /\bpuedo gastar\b/i
    ]
  },
  {
    intent: "budget_analysis",
    confidence: 0.9,
    patterns: [
      /\bbudget\b/i,
      /\bspendendo troppo\b/i,
      /\bspendo troppo\b/i,
      /\btoo much\b/i,
      /\bover budget\b/i,
      /\bdépense trop\b/i,
      /\bdepense trop\b/i,
      /\bgastando demasiado\b/i
    ]
  },
  {
    intent: "goal_analysis",
    confidence: 0.9,
    patterns: [
      /\bobiettiv/i,
      /\bgoals?\b/i,
      /\brisparmio\b/i,
      /\bsaving goals?\b/i,
      /\bobjectifs?\b/i,
      /\bobjetivos?\b/i
    ]
  },
  {
    intent: "forecast_check",
    confidence: 0.88,
    patterns: [
      /\bcome chiudo il mese\b/i,
      /\bchiudo il mese\b/i,
      /\bend of (the )?month\b/i,
      /\bforecast\b/i,
      /\bnext paycheck\b/i,
      /\bfinir le mois\b/i,
      /\bcierro el mes\b/i
    ]
  },
  {
    intent: "health_check",
    confidence: 0.84,
    patterns: [
      /\bcome sto andando\b/i,
      /\bcome va\b/i,
      /\bhow am i doing\b/i,
      /\bhealth check\b/i,
      /\bcome sono messo\b/i,
      /\bcomment.*m'en sors\b/i,
      /\bcomo voy\b/i,
      /\bcómo voy\b/i
    ]
  }
];

const CURRENCY_MAP: Record<string, string> = {
  euro: "EUR",
  eur: "EUR",
  "€": "EUR",
  dollar: "USD",
  dollars: "USD",
  usd: "USD",
  "\\$": "USD",
  gbp: "GBP",
  pound: "GBP",
  pounds: "GBP",
  "£": "GBP"
};

function parseAmount(message: string): number | undefined {
  const match = message.match(/(\d+(?:[.,]\d+)?)/);

  if (!match) {
    return undefined;
  }

  return Number(match[1].replace(",", "."));
}

function parseCurrency(message: string): string | undefined {
  for (const [token, currency] of Object.entries(CURRENCY_MAP)) {
    const pattern = new RegExp(token, "i");

    if (pattern.test(message)) {
      return currency;
    }
  }

  return undefined;
}

export function classifyIntent(message: string): IntentClassification {
  const normalized = message.trim();
  const amount = parseAmount(normalized);
  const currency = parseCurrency(normalized);

  for (const candidate of INTENT_PATTERNS) {
    if (candidate.patterns.some((pattern) => pattern.test(normalized))) {
      return {
        intent: candidate.intent,
        confidence: candidate.confidence,
        entities: {
          amount,
          currency
        }
      };
    }
  }

  return {
    intent: "unknown",
    confidence: 0.25,
    entities: {
      amount,
      currency
    }
  };
}
