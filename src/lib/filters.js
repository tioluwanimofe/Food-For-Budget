// Dietary filters remove items before the optimizer runs (low sodium is the
// exception: it caps the whole order's sodium). They work with every goal.
export const ALLERGENS = ['milk', 'egg', 'soy', 'wheat', 'sesame'];

export const LOW_SODIUM_MG = 1000;

export function applyFilters(items, { vegetarian, noPork, avoid = [] }) {
  return items.filter(
    (item) =>
      !(vegetarian && item.meat) &&
      !(noPork && item.meat === 'pork') &&
      !avoid.some((a) => item.allergens?.includes(a)),
  );
}
