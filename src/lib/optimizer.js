import solver from 'javascript-lp-solver';
import { GOALS } from './goals.js';

const round2 = (n) => Math.round(n * 100) / 100;

// Budget left for food once sales tax is set aside: budget / (1 + tax rate).
export function foodBudget(budget, taxRate) {
  return budget / (1 + taxRate);
}

const MACROS = [
  ['protein', 'proteinPct', 4],
  ['carbs', 'carbPct', 4],
  ['fat', 'fatPct', 9],
];

// Target share of macro calories for each macro, normalized to sum to 1.
function macroShares(options) {
  const raw = MACROS.map(([, key]) => Math.max(0, Number(options[key]) || 0));
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((r) => r / total);
}

// How far an order's macro split is from the target, in macro calories.
export function macroDeviation(order, options) {
  const shares = macroShares(options);
  const cals = MACROS.map(([m, , kcal]) => order[m] * kcal);
  const total = cals.reduce((a, b) => a + b, 0);
  return cals.reduce((d, c, i) => d + Math.abs(c - shares[i] * total), 0);
}

// The order's actual protein / carb / fat split, as whole percentages.
export function macroSplit(order) {
  const cals = MACROS.map(([m, , kcal]) => order[m] * kcal);
  const total = cals.reduce((a, b) => a + b, 0) || 1;
  return cals.map((c) => Math.round((c / total) * 100));
}

// Integer program: choose whole quantities of each item to optimize the
// goal's objective, keeping the pre-tax cost within the food budget, under any
// calorie / carb / sodium limits and over any protein / calorie minimum, with
// each item capped.
export function solve(items, options) {
  const { goal = 'protein', budget, taxRate, calorieLimit, carbLimit, sodiumLimit, proteinMin, calorieMin, cap } = options;
  const g = GOALS[goal];
  const constraints = { cost: { max: foodBudget(budget, taxRate) + 1e-9 } };
  if (calorieLimit) constraints.calories = { max: calorieLimit };
  if (carbLimit) constraints.carbs = { max: carbLimit };
  if (sodiumLimit) constraints.sodium = { max: sodiumLimit };
  if (proteinMin) constraints.protein = { min: proteinMin };
  if (calorieMin) constraints.calories = { ...constraints.calories, min: calorieMin };

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
      sodium: item.sodium ?? 0,
      [`cap_${item.id}`]: 1,
    };
    constraints[`cap_${item.id}`] = { max: itemCap };
    ints[item.id] = 1;
  }

  if (g.optimize === 'deviation') addMacroRows(items, variables, constraints, macroShares(options));

  // javascript-lp-solver ignores a constraint on the attribute being optimized
  // (e.g. a calorie cap while maximizing calories), so the objective gets its
  // own attribute name.
  for (const v of Object.values(variables)) v.objective = v[g.optimize] ?? 0;

  const result = solver.Solve({ optimize: 'objective', opType: g.opType, constraints, variables, ints });
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
    (!sodiumLimit || order.sodium <= sodiumLimit) &&
    (!proteinMin || order.protein >= proteinMin) &&
    (!calorieMin || order.calories >= calorieMin) &&
    lines.every((l) => l.item.id in variables && l.qty <= constraints[`cap_${l.item.id}`].max);
  return ok ? order : null;
}

// Balanced macros as a linear program: for each macro m, a deviation variable
// d_m >= |macroCal_m - share_m * totalMacroCal|, written as two rows, and the
// objective minimizes the sum of the d_m.
function addMacroRows(items, variables, constraints, shares) {
  MACROS.forEach(([m, , kcal], i) => {
    for (const item of items) {
      const v = variables[item.id];
      if (!v) continue;
      const total = MACROS.reduce((t, [mm, , k]) => t + (item[mm] ?? 0) * k, 0);
      const coef = (item[m] ?? 0) * kcal - shares[i] * total;
      v[`over_${m}`] = coef;
      v[`under_${m}`] = coef;
    }
    variables[`dev_${m}`] = { deviation: 1, [`over_${m}`]: -1, [`under_${m}`]: 1 };
    constraints[`over_${m}`] = { max: 0 };
    constraints[`under_${m}`] = { min: 0 };
  });
}

// Kept for callers that only want the default goal.
export function solveMaxProtein(items, options) {
  return solve(items, { ...options, goal: 'protein' });
}

export function summarize(lines, taxRate) {
  const sum = (key) => lines.reduce((t, l) => t + (l.item[key] ?? 0) * l.qty, 0);
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
    fat: sum('fat'),
    sodium: sum('sodium'),
    // Some chains are missing sodium for some items, or only have estimated carbs.
    sodiumKnown: lines.every((l) => l.item.sodium != null),
    carbsEstimated: lines.some((l) => l.item.carbsEstimated),
  };
}

// The order's score on the goal's objective (orders store price as subtotal).
function score(order, g, options) {
  if (g.optimize === 'cost') return order.subtotal;
  if (g.optimize === 'deviation') return macroDeviation(order, options);
  return order[g.optimize];
}

// The best order plus a fallback: for each item in the best order, re-solve
// as if that item were unavailable, and keep the best-scoring alternative.
// Whether order a beats order b on the goal's objective.
export function better(a, b, options) {
  const g = GOALS[options.goal ?? 'protein'];
  const sa = score(a, g, options);
  const sb = score(b, g, options);
  return g.opType === 'max' ? sa > sb : sa < sb;
}

export function planOrder(items, options) {
  const best = solve(items, options);
  if (!best) return { best: null, nextBest: null };

  let nextBest = null;
  for (const { item } of best.lines) {
    const without = items.map((i) => (i.id === item.id ? { ...i, cap: 0 } : i));
    const alt = solve(without, options);
    if (alt && (!nextBest || better(alt, nextBest, options))) {
      nextBest = { ...alt, missing: item.name };
    }
  }
  return { best, nextBest };
}

// One order always comes from one restaurant. For "all chains", plan each
// chain's menu separately and keep the best; `others` holds every other chain's
// best order, best first, so the card can compare. menus: [{ chain, items }].
export function planAcrossChains(menus, options) {
  const plans = menus
    .map(({ chain, items }) => ({ chain, ...planOrder(items, options) }))
    .filter((p) => p.best);
  if (plans.length === 0) return { best: null, nextBest: null, chain: null, others: [] };
  // Stable sort keeps the listed chain order on a tie.
  plans.sort((a, b) => (better(a.best, b.best, options) ? -1 : better(b.best, a.best, options) ? 1 : 0));
  const [top, ...rest] = plans;
  return { ...top, others: rest.map((p) => ({ chain: p.chain, best: p.best })) };
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
