// Each goal is the same integer program with a different objective and, for
// some, required rules. `targets` are the numbers the user types for that goal.
export const GOALS = {
  protein: {
    label: 'Max protein',
    blurb: 'Most protein for the money',
    optimize: 'protein',
    opType: 'max',
  },
  calories: {
    label: 'Calorie target',
    blurb: 'Most protein under a calorie cap',
    optimize: 'protein',
    opType: 'max',
    targets: [{ key: 'calorieLimit', label: 'Calories max', unit: 'cal', default: 600 }],
  },
  cheapest: {
    label: 'Cheapest meal',
    blurb: 'Lowest cost that hits a protein target',
    optimize: 'cost',
    opType: 'min',
    targets: [{ key: 'proteinMin', label: 'Protein at least', unit: 'g', default: 40 }],
  },
  lowcarb: {
    label: 'Low carb',
    blurb: 'Most protein with a hard carb cap',
    optimize: 'protein',
    opType: 'max',
    targets: [{ key: 'carbLimit', label: 'Carbs max', unit: 'g', default: 20 }],
  },
  balanced: {
    label: 'Balanced macros',
    blurb: 'Closest to your protein / carb / fat split (share of calories)',
    optimize: 'deviation',
    opType: 'min',
    targets: [
      { key: 'proteinPct', label: 'Protein', unit: '%', default: 40 },
      { key: 'carbPct', label: 'Carbs', unit: '%', default: 30 },
      { key: 'fatPct', label: 'Fat', unit: '%', default: 30 },
      { key: 'calorieMin', label: 'At least', unit: 'cal', default: 500 },
    ],
  },
  mostfood: {
    label: 'Most food',
    blurb: 'Most calories for the money',
    optimize: 'calories',
    opType: 'max',
  },
  pickforme: {
    label: 'Just pick for me',
    blurb: 'A filling meal from your favorites',
    optimize: 'calories',
    opType: 'max',
    favoritesOnly: true,
    // Without a ceiling, "most calories" spends the whole budget on several meals.
    targets: [{ key: 'calorieLimit', label: 'Calories max', unit: 'cal', default: 1200 }],
    // Spread the order across favorites instead of piling up one item.
    cap: 2,
  },
};

export const GOAL_IDS = Object.keys(GOALS);
