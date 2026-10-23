// Exhaustive checks: compare the solver against brute force over every
// possible order, for cheapest meal (budgets x protein targets x caps) and
// just pick for me (every set of favorites x budgets x calorie ceilings).
import { expect, it } from 'vitest';
import menu from '../data/menu.json';
import { solve, foodBudget, macroDeviation } from './optimizer.js';

const TAX = 0.0925;
const EPS = 1e-9;

// Enumerate every order (each item 0..cap), pruning on budget.
function* orders(items, caps, maxCost) {
  const qty = new Array(items.length).fill(0);
  function* rec(i, cost) {
    if (i === items.length) { yield qty.slice(); return; }
    for (let q = 0; q <= caps[i]; q++) {
      const c = cost + q * items[i].price;
      if (c > maxCost + EPS) break;
      qty[i] = q;
      yield* rec(i + 1, c);
    }
    qty[i] = 0;
  }
  yield* rec(0, 0);
}
const tot = (items, q, k) => items.reduce((s, it, i) => s + (it[k] ?? 0) * q[i], 0);

it('cheapest meal: solver matches brute force', () => {
  const items = menu.items;
  let cases = 0, bad = [];
  for (const cap of [1, 2, 3]) for (const budget of [3, 5, 7, 10, 12, 15, 20, 25, 30]) for (const proteinMin of [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 90, 120, 150]) {
    cases++;
    const fb = foodBudget(budget, TAX);
    let best = null;
    for (const q of orders(items, items.map(() => cap), fb)) {
      if (tot(items, q, 'protein') >= proteinMin) {
        const c = tot(items, q, 'price');
        if (best === null || c < best - EPS) best = c;
      }
    }
    const o = solve(items, { goal: 'cheapest', budget, taxRate: TAX, cap, proteinMin });
    const got = o ? o.subtotal : null;
    const ok = (best === null && got === null) || (best !== null && got !== null && Math.abs(Math.round(best * 100) / 100 - got) < 0.005);
    if (!ok) bad.push({ cap, budget, proteinMin, brute: best && +best.toFixed(2), solver: got, order: o && o.lines.map(l => `${l.qty} ${l.item.id}`).join(', ') });
  }
  console.log('CHEAPEST cases', cases, 'mismatches', bad.length);
  expect(bad).toEqual([]);
}, 600000);

it('just pick for me: solver matches brute force for every favorites set', () => {
  const all = menu.items;
  let cases = 0, bad = [];
  for (let mask = 1; mask < 1 << all.length; mask++) {
    const items = all.map((it, i) => ({ ...it, favorite: !!(mask & (1 << i)) }));
    const favs = items.filter((i) => i.favorite);
    for (const [budget, calorieLimit] of [[3, 1200], [5, 1200], [10, 1200], [15, 1200], [25, 1200], [25, 800], [25, 2000]]) {
      cases++;
      const fb = foodBudget(budget, TAX);
      let best = null;
      for (const q of orders(favs, favs.map(() => 2), fb)) {
        const cal = tot(favs, q, 'calories');
        if (cal > 0 && cal <= calorieLimit && (best === null || cal > best)) best = cal;
      }
      const o = solve(items, { goal: 'pickforme', budget, taxRate: TAX, cap: 3, calorieLimit });
      const got = o ? o.calories : null;
      const onlyFavs = !o || o.lines.every((l) => l.item.favorite && l.qty <= 2);
      if (best !== got || !onlyFavs) bad.push({ favs: favs.map((f) => f.id).join(','), budget, calorieLimit, brute: best, solver: got, onlyFavs });
    }
  }
  console.log('PICK cases', cases, 'mismatches', bad.length);
  expect(bad).toEqual([]);
}, 600000);

it('every goal: solver matches brute force, with and without limits', () => {
  const items = menu.items;
  const split = { proteinPct: 40, carbPct: 30, fatPct: 30 };
  const goals = {
    protein: { score: (o) => o.protein, dir: 1 },
    calories: { score: (o) => o.protein, dir: 1, extra: { calorieLimit: 600 } },
    lowcarb: { score: (o) => o.protein, dir: 1, extra: { carbLimit: 20 } },
    mostfood: { score: (o) => o.calories, dir: 1 },
    balanced: { score: (o) => macroDeviation(o, split), dir: -1, extra: { ...split, calorieMin: 500 } },
  };
  const limitSets = [{}, { calorieLimit: 900 }, { carbLimit: 60 }, { sodiumLimit: 1000 }, { calorieLimit: 1000, carbLimit: 80, sodiumLimit: 1500 }];
  let cases = 0;
  const bad = [];
  for (const [goal, g] of Object.entries(goals)) {
    for (const budget of [5, 10, 15]) {
      for (const limits of limitSets) {
        const opts = { ...limits, ...g.extra };
        cases++;
        let best = null;
        for (const q of orders(items, items.map(() => 2), foodBudget(budget, TAX))) {
          const o = Object.fromEntries(['protein', 'calories', 'carbs', 'fat', 'sodium'].map((k) => [k, tot(items, q, k)]));
          if (o.calories === 0) continue;
          if (opts.calorieLimit && o.calories > opts.calorieLimit) continue;
          if (opts.carbLimit && o.carbs > opts.carbLimit) continue;
          if (opts.sodiumLimit && o.sodium > opts.sodiumLimit) continue;
          if (opts.calorieMin && o.calories < opts.calorieMin) continue;
          const sc = g.score(o);
          if (best === null || g.dir * (sc - best) > 1e-6) best = sc;
        }
        const r = solve(items, { goal, budget, taxRate: TAX, cap: 2, ...opts });
        const got = r ? g.score(r) : null;
        const ok = best === null ? got === null : got !== null && Math.abs(got - best) < 1e-6;
        if (!ok) bad.push({ goal, budget, opts, brute: best, solver: got });
      }
    }
  }
  console.log('ALL GOALS cases', cases, 'mismatches', bad.length);
  expect(bad).toEqual([]);
}, 600000);
