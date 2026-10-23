import { describe, expect, it } from 'vitest';
import menu from '../data/chains/mcdonalds.json';
import { cashierLine, foodBudget, macroDeviation, macroSplit, planOrder, solve, solveMaxProtein } from './optimizer.js';
import { applyFilters } from './filters.js';

const base = { budget: 10, taxRate: 0.0925, cap: 3 };

describe('foodBudget', () => {
  it('sets tax aside first', () => {
    expect(foodBudget(10, 0.0925)).toBeCloseTo(9.15, 2);
  });
});

describe('solveMaxProtein', () => {
  it('stays within budget including tax', () => {
    const order = solveMaxProtein(menu.items, base);
    expect(order.total).toBeLessThanOrEqual(10);
    expect(order.protein).toBeGreaterThan(0);
  });

  it('beats or matches any single item that fits', () => {
    const order = solveMaxProtein(menu.items, base);
    const fit = menu.items.filter((i) => i.price * 1.0925 <= 10);
    expect(order.protein).toBeGreaterThanOrEqual(Math.max(...fit.map((i) => i.protein)));
  });

  it('respects the per-item cap', () => {
    const order = solveMaxProtein(menu.items, { ...base, budget: 40, cap: 2 });
    for (const l of order.lines) expect(l.qty).toBeLessThanOrEqual(2);
  });

  it('respects calorie and carb limits', () => {
    const order = solveMaxProtein(menu.items, { ...base, budget: 20, calorieLimit: 600, carbLimit: 40 });
    expect(order.calories).toBeLessThanOrEqual(600);
    expect(order.carbs).toBeLessThanOrEqual(40);
  });

  it('returns null when nothing fits', () => {
    expect(solveMaxProtein(menu.items, { ...base, budget: 1 })).toBeNull();
  });
});

describe('planOrder', () => {
  it('gives a next best option that avoids one item of the best order', () => {
    const { best, nextBest } = planOrder(menu.items, base);
    expect(nextBest).not.toBeNull();
    expect(nextBest.protein).toBeLessThanOrEqual(best.protein);
    expect(nextBest.lines.some((l) => l.item.name === nextBest.missing)).toBe(false);
  });
});

describe('cashierLine', () => {
  it('reads naturally', () => {
    const [mcdouble, nuggets] = ['mcdouble', 'nuggets-10'].map((id) => menu.items.find((i) => i.id === id));
    expect(cashierLine([{ item: mcdouble, qty: 2 }, { item: nuggets, qty: 1 }])).toBe(
      'Can I get 2 McDoubles and a 10-piece McNuggets, please?',
    );
  });
});

describe('goal modes', () => {
  const run = (goal, extra = {}) => solve(menu.items, { ...base, goal, ...extra });

  it('calorie target keeps calories under the cap', () => {
    const order = run('calories', { calorieLimit: 600 });
    expect(order.calories).toBeLessThanOrEqual(600);
  });

  it('cheapest meal hits the protein target at the lowest cost', () => {
    const order = run('cheapest', { proteinMin: 40 });
    expect(order.protein).toBeGreaterThanOrEqual(40);
    // Max protein for the same budget costs at least as much.
    expect(order.subtotal).toBeLessThanOrEqual(run('protein').subtotal);
    // Two McDoubles (44 g, $7.00) is a valid answer, so the cheapest is no more than that.
    expect(order.subtotal).toBeLessThanOrEqual(7);
  });

  it('cheapest meal returns null when the target is out of reach', () => {
    expect(run('cheapest', { proteinMin: 500 })).toBeNull();
  });

  it('low carb keeps carbs under the cap', () => {
    const order = run('lowcarb', { budget: 15, carbLimit: 20 });
    expect(order.carbs).toBeLessThanOrEqual(20);
  });

  it('most food maximizes calories', () => {
    expect(run('mostfood').calories).toBeGreaterThanOrEqual(run('protein').calories);
  });

  it('just pick for me uses only favorites, at most 2 of each', () => {
    const favs = new Set(['mcchicken', 'small-fries', 'hamburger']);
    const items = menu.items.map((i) => ({ ...i, favorite: favs.has(i.id) }));
    const order = solve(items, { ...base, goal: 'pickforme', cap: 3 });
    for (const l of order.lines) {
      expect(favs.has(l.item.id)).toBe(true);
      expect(l.qty).toBeLessThanOrEqual(2);
    }
  });

  it('just pick for me returns null with no favorites', () => {
    expect(run('pickforme')).toBeNull();
  });

  it('next best for cheapest meal costs at least as much', () => {
    const { best, nextBest } = planOrder(menu.items, { ...base, goal: 'cheapest', proteinMin: 40 });
    expect(nextBest.subtotal).toBeGreaterThanOrEqual(best.subtotal);
  });
});

describe('balanced macros', () => {
  const split = { proteinPct: 40, carbPct: 30, fatPct: 30, calorieMin: 500 };

  it('meets the calorie floor and lands near the split', () => {
    const order = solve(menu.items, { ...base, budget: 15, goal: 'balanced', ...split });
    expect(order.calories).toBeGreaterThanOrEqual(500);
    // No single-item order that fits is closer to the split than the solver's.
    const singles = menu.items
      .flatMap((i) => [1, 2, 3].map((qty) => ({ lines: [{ item: i, qty }] })))
      .map((o) => ({ ...o, ...Object.fromEntries(['protein', 'carbs', 'fat', 'calories', 'price'].map((k) => [k, o.lines[0].item[k] * o.lines[0].qty])) }))
      .filter((o) => o.calories >= 500 && o.price * 1.0925 <= 15);
    for (const o of singles) expect(macroDeviation(order, split)).toBeLessThanOrEqual(macroDeviation(o, split) + 1e-6);
  });

  it('reports the split as percentages', () => {
    expect(macroSplit({ protein: 25, carbs: 25, fat: 0 })).toEqual([50, 50, 0]);
  });
});

describe('filters', () => {
  it('removes items with an avoided allergen', () => {
    const left = applyFilters(menu.items, { avoid: ['milk'] });
    expect(left.length).toBeGreaterThan(0);
    for (const i of left) expect(i.allergens).not.toContain('milk');
  });

  it('vegetarian leaves nothing on this menu (fries use beef flavor)', () => {
    expect(applyFilters(menu.items, { vegetarian: true })).toEqual([]);
  });

  it('low sodium caps the whole order', () => {
    const order = solve(menu.items, { ...base, sodiumLimit: 1000 });
    expect(order.sodium).toBeLessThanOrEqual(1000);
  });

  it('every item has fat, sodium and allergen data', () => {
    for (const i of menu.items) {
      expect(typeof i.fat).toBe('number');
      expect(typeof i.sodium).toBe('number');
      expect(Array.isArray(i.allergens)).toBe(true);
    }
  });
});
