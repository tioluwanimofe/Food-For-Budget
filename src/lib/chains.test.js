import { describe, expect, it } from 'vitest';
import { CHAINS, CHAIN_BY_ID } from '../data/chains/index.js';
import { applyFilters } from './filters.js';
import { better, foodBudget, planAcrossChains, solve } from './optimizer.js';

const TAX = 0.0925;
const base = { budget: 15, taxRate: TAX, cap: 3 };
const menus = CHAINS.map((chain) => ({ chain, items: chain.items }));

describe('chain data', () => {
  it('every item id is unique across chains', () => {
    const ids = CHAINS.flatMap((c) => c.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every item has a price, protein, calories, carbs and fat', () => {
    for (const c of CHAINS) {
      expect(c.name && c.priceNote).toBeTruthy();
      for (const i of c.items) {
        for (const k of ['price', 'protein', 'calories', 'carbs', 'fat']) {
          expect(typeof i[k], `${i.id}.${k}`).toBe('number');
          expect(i[k], `${i.id}.${k}`).toBeGreaterThanOrEqual(0);
        }
        expect(i.price, i.id).toBeGreaterThan(0);
        expect(i.say?.length, i.id).toBe(2);
      }
    }
  });

  it('macros roughly add up to the calories', () => {
    for (const c of CHAINS) {
      for (const i of c.items.filter((x) => !x.carbsEstimated)) {
        const kcal = 4 * i.protein + 4 * i.carbs + 9 * i.fat;
        expect(Math.abs(kcal - i.calories) / i.calories, i.id).toBeLessThan(0.2);
      }
    }
  });
});

describe('filters with unknown data', () => {
  const panera = CHAIN_BY_ID.panera.items;

  it('leave out items with unknown allergens when an allergen is avoided', () => {
    const left = applyFilters(panera, { avoid: ['sesame'] });
    expect(left.length).toBeGreaterThan(0);
    expect(left.every((i) => Array.isArray(i.allergens) && !i.allergens.includes('sesame'))).toBe(true);
  });

  it('leave out items with unknown sodium when low sodium is on', () => {
    const left = applyFilters(panera, { lowSodium: true });
    expect(left.length).toBeGreaterThan(0);
    expect(left.every((i) => i.sodium != null)).toBe(true);
  });

  it('keep unknown-data items when no such filter is on', () => {
    expect(applyFilters(panera, {})).toHaveLength(panera.length);
  });

  it('vegetarian finds something at Taco Bell, Chipotle and Panera', () => {
    for (const id of ['tacobell', 'chipotle', 'panera']) {
      const order = solve(applyFilters(CHAIN_BY_ID[id].items, { vegetarian: true }), base);
      expect(order, id).not.toBeNull();
      expect(order.lines.every((l) => !l.item.meat)).toBe(true);
    }
  });
});

describe('planAcrossChains', () => {
  const goals = [
    ['protein', {}],
    ['cheapest', { proteinMin: 40 }],
    ['mostfood', {}],
    ['lowcarb', { carbLimit: 20 }],
    ['balanced', { proteinPct: 40, carbPct: 30, fatPct: 30, calorieMin: 500 }],
  ];

  it.each(goals)('%s: picks the chain whose best order wins, from one chain only', (goal, extra) => {
    const options = { ...base, goal, ...extra };
    const plan = planAcrossChains(menus, options);
    expect(plan.best).not.toBeNull();
    const ids = new Set(plan.chain.items.map((i) => i.id));
    expect(plan.best.lines.every((l) => ids.has(l.item.id))).toBe(true);
    for (const { chain } of menus) {
      const own = solve(chain.items, options);
      if (own) expect(better(own, plan.best, options), chain.id).toBe(false);
    }
    expect(plan.others.length).toBe(menus.length - 1);
  });

  it('returns nothing when no chain fits', () => {
    const plan = planAcrossChains(menus, { ...base, budget: 1 });
    expect(plan).toEqual({ best: null, nextBest: null, chain: null, others: [] });
  });

  it('reports unknown sodium and estimated carbs on the order', () => {
    const items = CHAIN_BY_ID.panera.items.filter((i) => i.sodium == null && i.carbsEstimated);
    const order = solve(items, base);
    expect(order.sodiumKnown).toBe(false);
    expect(order.carbsEstimated).toBe(true);
  });
});

// Brute force over every order on each chain's menu (each item 0..2), as in
// optimizer.exhaustive.test.js.
function* orders(items, cap, maxCost) {
  const qty = new Array(items.length).fill(0);
  function* rec(i, cost) {
    if (i === items.length) { yield qty; return; }
    for (let q = 0; q <= cap; q++) {
      const c = cost + q * items[i].price;
      if (c > maxCost + 1e-9) break;
      qty[i] = q;
      yield* rec(i + 1, c);
    }
    qty[i] = 0;
  }
  yield* rec(0, 0);
}
const tot = (items, q, k) => items.reduce((s, it, i) => s + (it[k] ?? 0) * q[i], 0);

describe('every chain: solver matches brute force', () => {
  const goals = {
    protein: { score: (o) => o.protein, dir: 1 },
    lowcarb: { score: (o) => o.protein, dir: 1, extra: { carbLimit: 40 } },
    mostfood: { score: (o) => o.calories, dir: 1, extra: { calorieLimit: 1500 } },
    cheapest: { score: (o) => -o.price, dir: 1, extra: { proteinMin: 50 } },
  };
  it.each(CHAINS.map((c) => [c.name, c]))('%s', (_, chain) => {
    const items = [...chain.items].sort((a, b) => b.price - a.price);
    const bad = [];
    for (const [goal, g] of Object.entries(goals)) {
      for (const budget of [8, 14, 20, 25]) {
        const opts = g.extra ?? {};
        let best = null;
        for (const q of orders(items, 2, foodBudget(budget, TAX))) {
          const o = Object.fromEntries(['protein', 'calories', 'carbs', 'price'].map((k) => [k, tot(items, q, k)]));
          if (o.calories === 0) continue;
          if (opts.carbLimit && o.carbs > opts.carbLimit) continue;
          if (opts.calorieLimit && o.calories > opts.calorieLimit) continue;
          if (opts.proteinMin && o.protein < opts.proteinMin) continue;
          const sc = g.score(o);
          if (best === null || g.dir * (sc - best) > 1e-6) best = sc;
        }
        const r = solve(items, { goal, budget, taxRate: TAX, cap: 2, ...opts });
        const got = r ? g.score({ ...r, price: r.subtotal }) : null;
        const ok = best === null ? got === null : got !== null && Math.abs(got - best) < 0.005;
        if (!ok) bad.push({ goal, budget, brute: best, solver: got });
      }
    }
    expect(bad).toEqual([]);
  }, 600000);
});
