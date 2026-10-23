// Dietary filters remove items before the optimizer runs (low sodium is the
// exception: it caps the whole order's sodium). They work with every goal.
// Items with unknown allergens (allergens: null) are left out when any
// allergen is avoided, and items with unknown sodium when low sodium is on.
export const ALLERGENS = ['milk', 'egg', 'soy', 'wheat', 'sesame'];

export const LOW_SODIUM_MG = 1000;

export function applyFilters(items, { vegetarian, noPork, lowSodium, avoid = [] }) {
  return items.filter(
    (item) =>
      !(vegetarian && item.meat) &&
      !(noPork && item.meat === 'pork') &&
      !(lowSodium && item.sodium == null) &&
      !(avoid.length > 0 && item.allergens == null) &&
      !avoid.some((a) => item.allergens?.includes(a)),
  );
}
