import type {
  BeforeYouBuyResponse,
  CoachDecisionExplanation,
  CoachTodaySummary,
  CoachWeeklySummary,
  TodayResponse
} from "./api";

interface CopyHelpers {
  t: (key: string, variables?: Record<string, string | number>) => string;
  formatCurrency: (amount: number, currency: string) => string;
  formatDate: (date: string) => string;
  formatDecisionLabel: (value: "safe" | "caution" | "hold") => string;
}

export interface LocalizedCoachContent {
  summary: string;
  why: string[];
  whatChanged: string[];
  nextSteps: string[];
}

function riskToneKey(risk: "safe" | "caution" | "hold"): string {
  switch (risk) {
    case "safe":
      return "decision.safe";
    case "caution":
      return "decision.caution";
    case "hold":
      return "decision.hold";
  }
}

export function buildTodayExplanations(
  today: TodayResponse,
  helpers: CopyHelpers
): string[] {
  const { formatCurrency, t } = helpers;
  return [
    t("today.explanation.start", {
      amount: formatCurrency(today.inputs.available_balance, today.currency)
    }),
    t("today.explanation.income", {
      amount: formatCurrency(today.inputs.expected_income_today, today.currency)
    }),
    t("today.explanation.reserved", {
      essentials: formatCurrency(today.inputs.essential_obligations, today.currency),
      buffer: formatCurrency(today.inputs.safety_buffer, today.currency)
    }),
    t("today.explanation.protected", {
      goals: formatCurrency(today.inputs.planned_goal_contribution, today.currency),
      committed: formatCurrency(today.inputs.committed_spending, today.currency)
    })
  ];
}

export function buildPurchaseExplanations(
  result: BeforeYouBuyResponse,
  helpers: CopyHelpers
): string[] {
  const { formatCurrency, t } = helpers;
  return [
    t("buy.explanation.current", {
      amount: formatCurrency(result.current_available_to_spend, result.currency)
    }),
    t("buy.explanation.purchase", {
      amount: formatCurrency(result.purchase_amount, result.currency)
    }),
    t("buy.explanation.remaining", {
      amount: formatCurrency(result.available_to_spend_after_purchase, result.currency)
    })
  ];
}

export function buildTodayCoachContent(
  today: TodayResponse,
  _coach: CoachTodaySummary | null,
  helpers: CopyHelpers
): LocalizedCoachContent {
  const { formatCurrency, t } = helpers;
  const riskLabel = t(riskToneKey(today.risk_level)).toLowerCase();
  const whatChanged: string[] = [];

  if (today.inputs.expected_income_today > 0) {
    whatChanged.push(
      t("coach.today.changed.income", {
        amount: formatCurrency(today.inputs.expected_income_today, today.currency)
      })
    );
  }
  if (today.inputs.essential_obligations > 0) {
    whatChanged.push(
      t("coach.today.changed.essentials", {
        amount: formatCurrency(today.inputs.essential_obligations, today.currency)
      })
    );
  }
  if (today.inputs.committed_spending > 0) {
    whatChanged.push(
      t("coach.today.changed.committed", {
        amount: formatCurrency(today.inputs.committed_spending, today.currency)
      })
    );
  }
  if (whatChanged.length === 0) {
    whatChanged.push(t("coach.today.changed.none"));
  }

  const nextSteps = [t("coach.today.next.buy"), t("coach.today.next.refresh")];
  if (today.risk_level === "caution") {
    nextSteps.unshift(t("coach.today.next.caution"));
  } else if (today.risk_level === "hold") {
    nextSteps.unshift(t("coach.today.next.hold"));
  } else {
    nextSteps.unshift(t("coach.today.next.safe"));
  }

  return {
    summary: t("coach.today.summary", {
      risk: riskLabel,
      amount: formatCurrency(today.available_to_spend_today, today.currency)
    }),
    why: [
      t("coach.today.why.available", {
        risk: riskLabel,
        amount: formatCurrency(today.available_to_spend_today, today.currency)
      }),
      t("coach.today.why.balance", {
        amount: formatCurrency(today.inputs.available_balance, today.currency)
      }),
      t("coach.today.why.protection", {
        amount: formatCurrency(
          today.inputs.essential_obligations +
            today.inputs.committed_spending +
            today.inputs.safety_buffer +
            today.inputs.planned_goal_contribution,
          today.currency
        )
      })
    ],
    whatChanged: whatChanged.slice(0, 3),
    nextSteps: nextSteps.slice(0, 3)
  };
}

export function buildDecisionCoachContent(
  decision: BeforeYouBuyResponse,
  baselineRiskLevel: "safe" | "caution" | "hold",
  description: string | undefined,
  helpers: CopyHelpers
): LocalizedCoachContent {
  const { formatCurrency, t } = helpers;
  const item = description?.trim() || t("buy.itemFallback");
  const riskLabel = t(riskToneKey(decision.decision)).toLowerCase();
  const baselineLabel = t(riskToneKey(baselineRiskLevel)).toLowerCase();

  const nextSteps = [t("coach.buy.next.current")];
  if (decision.decision === "safe") {
    nextSteps.push(t("coach.buy.next.safe"));
  } else if (decision.decision === "caution") {
    nextSteps.push(t("coach.buy.next.caution"));
  } else {
    nextSteps.push(t("coach.buy.next.hold"));
  }

  return {
    summary: t("coach.buy.summary", {
      item,
      risk: riskLabel,
      amount: formatCurrency(decision.available_to_spend_after_purchase, decision.currency)
    }),
    why: [
      t("coach.buy.why.current", {
        amount: formatCurrency(decision.current_available_to_spend, decision.currency)
      }),
      t("coach.buy.why.purchase", {
        item,
        amount: formatCurrency(decision.purchase_amount, decision.currency)
      }),
      t("coach.buy.why.decision", {
        baseline: baselineLabel,
        decision: riskLabel
      })
    ],
    whatChanged: [
      t("coach.buy.changed.remaining", {
        amount: formatCurrency(decision.available_to_spend_after_purchase, decision.currency)
      }),
      t("coach.buy.changed.delta", {
        amount: formatCurrency(decision.delta, decision.currency)
      }),
      t("coach.buy.changed.afford", {
        decision: riskLabel
      })
    ],
    nextSteps: nextSteps.slice(0, 3)
  };
}

export function buildWeeklyCoachContent(
  weekly: CoachWeeklySummary,
  helpers: CopyHelpers
): LocalizedCoachContent {
  const { formatCurrency, formatDate, t } = helpers;
  const net = weekly.documented_income - weekly.documented_outgoing;
  const riskLabel = t(riskToneKey(weekly.risk_level)).toLowerCase();
  const nextSteps =
    weekly.documented_outgoing > weekly.documented_income
      ? [t("coach.week.next.pressure"), t("coach.week.next.review"), t("coach.week.next.buy")]
      : [t("coach.week.next.stable"), t("coach.week.next.review"), t("coach.week.next.buy")];

  return {
    summary:
      net > 0
        ? t("coach.week.summary.support", {
            amount: formatCurrency(net, weekly.currency),
            risk: riskLabel
          })
        : net < 0
          ? t("coach.week.summary.pressure", {
              amount: formatCurrency(Math.abs(net), weekly.currency),
              risk: riskLabel
            })
          : t("coach.week.summary.flat"),
    why: [
      t("coach.week.why.today", {
        risk: riskLabel,
        amount: formatCurrency(weekly.current_available_to_spend, weekly.currency)
      }),
      t("coach.week.why.income", {
        amount: formatCurrency(weekly.documented_income, weekly.currency)
      }),
      t("coach.week.why.outgoing", {
        amount: formatCurrency(weekly.documented_outgoing, weekly.currency)
      })
    ],
    whatChanged:
      weekly.upcoming_items_count > 0
        ? [
            t("coach.week.changed.window", {
              start: formatDate(weekly.period_start),
              end: formatDate(weekly.period_end)
            }),
            t("coach.week.changed.items", {
              count: weekly.upcoming_items_count
            }),
            t("coach.week.changed.net", {
              amount: formatCurrency(net, weekly.currency)
            })
          ]
        : [t("coach.week.changed.none")],
    nextSteps
  };
}
