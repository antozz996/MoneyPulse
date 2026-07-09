import { createMoneyAmount, maxMoney, subtractMoney, sumMoney, zeroMoney } from "./money";
import type { Goal, GoalPriority, GoalStatus, GoalStatusItem } from "./types";

function priorityWeight(priority: GoalPriority): number {
  switch (priority) {
    case "ESSENTIAL":
      return 0;
    case "IMPORTANT":
      return 1;
    case "FLEXIBLE":
      return 2;
  }
}

function calculateRequiredThisCycle(goal: Goal): GoalStatusItem["requiredThisCycle"] {
  const uncoveredContribution = goal.plannedContribution.amount - goal.reservedAmount.amount;

  return createMoneyAmount(
    Math.max(0, uncoveredContribution),
    goal.plannedContribution.currency
  );
}

export function calculateGoalStatus(
  goals: readonly Goal[],
  currency: string
): GoalStatus {
  const items = goals
    .filter((goal) => goal.active !== false)
    .map<GoalStatusItem>((goal) => {
      const requiredThisCycle = calculateRequiredThisCycle(goal);
      const covered = requiredThisCycle.amount === 0;
      const deferred = goal.priority === "FLEXIBLE" && !covered;

      return {
        id: goal.id,
        name: goal.name,
        priority: goal.priority,
        targetAmount: goal.targetAmount,
        plannedContribution: goal.plannedContribution,
        reservedAmount: goal.reservedAmount,
        requiredThisCycle,
        covered,
        deferred
      };
    })
    .sort((left, right) => priorityWeight(left.priority) - priorityWeight(right.priority));

  const essentialCovered = items
    .filter((item) => item.priority === "ESSENTIAL")
    .every((item) => item.covered);
  const importantCovered = items
    .filter((item) => item.priority === "IMPORTANT")
    .every((item) => item.covered);
  const flexibleDeferred = items.some(
    (item) => item.priority === "FLEXIBLE" && item.requiredThisCycle.amount > 0
  );
  const remainingThisCycle = sumMoney(
    items
      .filter((item) => item.priority === "ESSENTIAL" || item.priority === "IMPORTANT")
      .map((item) => item.requiredThisCycle),
    currency
  );
  const totalRequiredThisCycle = sumMoney(
    items.map((item) => item.requiredThisCycle),
    currency
  );

  return {
    items,
    totalRequiredThisCycle,
    remainingThisCycle,
    essentialCovered,
    importantCovered,
    flexibleDeferred
  };
}

export function summarizeGoals(goals: readonly Goal[], currency: string) {
  return {
    currency,
    totalTargets: sumMoney(goals.map((goal) => goal.targetAmount), currency),
    totalReserved: sumMoney(goals.map((goal) => goal.reservedAmount), currency),
    totalPlanned: sumMoney(goals.map((goal) => goal.plannedContribution), currency)
  };
}
