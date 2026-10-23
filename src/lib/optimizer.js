import solver from 'javascript-lp-solver';

const round2 = (n) => Math.round(n * 100) / 100;

// Budget left for food once sales tax is set aside: budget / (1 + tax rate).
export function foodBudget(budget, taxRate) {
  return budget / (1 + taxRate);
}

// Integer program: choose whole quantities of each item to maximize protein,
// keeping the pre-tax cost within the food budget and under any optional
// calorie / carb limits, with each item capped at `cap`.
export function solveMaxProtein(items, { budget, taxRate, calorieLimit, carbLimit, cap }) {
  const constraints = { cost: { max: foodBudget(budget, taxRate) + 1e-9 } };
  if (calorieLimit) constraints.calories = { max: calorieLimit };
  if (carbLimit) constraints.carbs = { max: carbLimit };

  const variables = {};
  const ints = {};
  for (const item of items) {
    const itemCap = item.cap ?? cap;
    if (itemCap <= 0 || !(item.price > 0)) continue;
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

  const result = solver.Solve({ optimize: 'protein', opType: 'max', constraints, variables, ints });
  if (!result.feasible) return null;

  const lines = items
    .map((item) => ({ item, qty: Math.round(result[item.id] ?? 0) }))
    .filter((l) => l.qty > 0);
  if (lines.length === 0) return null;
  return summarize(lines, taxRate);
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

// The best order plus a fallback: for each item in the best order, re-solve
// as if that item were unavailable, and keep the highest-protein alternative.
export function planOrder(items, options) {
  const best = solveMaxProtein(items, options);
  if (!best) return { best: null, nextBest: null };

  let nextBest = null;
  for (const { item } of best.lines) {
    const without = items.map((i) => (i.id === item.id ? { ...i, cap: 0 } : i));
    const alt = solveMaxProtein(without, options);
    if (alt && (!nextBest || alt.protein > nextBest.protein)) {
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
