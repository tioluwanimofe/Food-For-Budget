// Each goal is the same integer program with a different objective and, for
// some, one required rule. `target` is the number the user types for that goal.
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
    target: { key: 'calorieLimit', label: 'Calories max', unit: 'cal', default: 600 },
  },
  cheapest: {
    label: 'Cheapest meal',
    blurb: 'Lowest cost that hits a protein target',
    optimize: 'cost',
    opType: 'min',
    target: { key: 'proteinMin', label: 'Protein at least', unit: 'g', default: 40 },
  },
  lowcarb: {
    label: 'Low carb',
    blurb: 'Most protein with a hard carb cap',
    optimize: 'protein',
    opType: 'max',
    target: { key: 'carbLimit', label: 'Carbs max', unit: 'g', default: 20 },
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
    // Spread the order across favorites instead of piling up one item.
    cap: 2,
  },
};

export const GOAL_IDS = Object.keys(GOALS);
