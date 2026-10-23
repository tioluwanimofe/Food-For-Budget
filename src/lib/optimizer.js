import solver from 'javascript-lp-solver';
import { GOALS } from './goals.js';

const round2 = (n) => Math.round(n * 100) / 100;

// Budget left for food once sales tax is set aside: budget / (1 + tax rate).
export function foodBudget(budget, taxRate) {
  return budget / (1 + taxRate);
}

// Integer program: choose whole quantities of each item to optimize the
// goal's objective, keeping the pre-tax cost within the food budget, under any
// calorie / carb limits and over any protein minimum, with each item capped.
export function solve(items, { goal = 'protein', budget, taxRate, calorieLimit, carbLimit, proteinMin, cap }) {
  const g = GOALS[goal];
  const constraints = { cost: { max: foodBudget(budget, taxRate) + 1e-9 } };
  if (calorieLimit) constraints.calories = { max: calorieLimit };
  if (carbLimit) constraints.carbs = { max: carbLimit };
  if (proteinMin) constraints.protein = { min: proteinMin };

  const variables = {};
  const ints = {};
  for (const item of items) {
    const itemCap = Math.min(item.cap ?? cap, g.cap ?? Infinity);
    if (itemCap <= 0 || !(item.price > 0)) continue;
    if (g.favoritesOnly && !item.favorite) continue;
    variables[item.id] = {
      protein: item.protein,
      cost: item.price,
      calories: item.calories,
      carbs: item.carbs,
      [`cap_${item.id}`]: 1,
    };
    constraints[`cap_${item.id}`] = { max: itemCap };
    ints[item.id] = 1;
  }

  const result = solver.Solve({ optimize: g.optimize, opType: g.opType, constraints, variables, ints });
  if (!result.feasible) return null;

  const lines = items
    .map((item) => ({ item, qty: Math.round(result[item.id] ?? 0) }))
    .filter((l) => l.qty > 0);
  if (lines.length === 0) return null;

  // The solver's branch and bound can flag an impossible program as feasible,
  // so check the rounded order against every rule before trusting it.
  const order = summarize(lines, taxRate);
  const ok =
    order.subtotal <= foodBudget(budget, taxRate) + 1e-9 &&
    (!calorieLimit || order.calories <= calorieLimit) &&
    (!carbLimit || order.carbs <= carbLimit) &&
    (!proteinMin || order.protein >= proteinMin) &&
    lines.every((l) => l.item.id in variables && l.qty <= constraints[`cap_${l.item.id}`].max);
  return ok ? order : null;
}

// Kept for callers that only want the default goal.
export function solveMaxProtein(items, options) {
  return solve(items, { ...options, goal: 'protein' });
}

export function summarize(lines, taxRate) {
  const sum = (key) => lines.reduce((t, l) => t + l.item[key] * l.qty, 0);
  const subtotal = round2(sum('price'));
  const tax = round2(subtotal * taxRate);
  return {
    lines,
    subtotal,
    tax,
    total: round2(subtotal + tax),
    protein: sum('protein'),
    calories: sum('calories'),
    carbs: sum('carbs'),
  };
}

// The order's score on the goal's objective (orders store price as subtotal).
const score = (order, g) => (g.optimize === 'cost' ? order.subtotal : order[g.optimize]);

// The best order plus a fallback: for each item in the best order, re-solve
// as if that item were unavailable, and keep the best-scoring alternative.
export function planOrder(items, options) {
  const g = GOALS[options.goal ?? 'protein'];
  const best = solve(items, options);
  if (!best) return { best: null, nextBest: null };

  const better = (a, b) => (g.opType === 'max' ? score(a, g) > score(b, g) : score(a, g) < score(b, g));
  let nextBest = null;
  for (const { item } of best.lines) {
    const without = items.map((i) => (i.id === item.id ? { ...i, cap: 0 } : i));
    const alt = solve(without, options);
    if (alt && (!nextBest || better(alt, nextBest))) {
      nextBest = { ...alt, missing: item.name };
    }
  }
  return { best, nextBest };
}

// "Can I get 2 McDoubles and a 10-piece McNuggets, please?"
export function cashierLine(lines) {
  const parts = lines.map(({ item, qty }) => {
    const [one, many] = item.say ?? [item.name, item.name];
    if (qty === 1) return `${/^[aeiou]/i.test(one) ? 'an' : 'a'} ${one}`;
    return `${qty} ${many}`;
  });
  const list =
    parts.length <= 1
      ? parts.join('')
      : `${parts.slice(0, -1).join(', ')}${parts.length > 2 ? ',' : ''} and ${parts.at(-1)}`;
  return `Can I get ${list}, please?`;
}
