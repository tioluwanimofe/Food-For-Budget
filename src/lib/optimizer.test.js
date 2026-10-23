import { describe, expect, it } from 'vitest';
import menu from '../data/menu.json';
import { cashierLine, foodBudget, planOrder, solveMaxProtein } from './optimizer.js';

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
