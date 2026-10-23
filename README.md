# Food for Budget

Say "I'm hungry," enter how much you want to spend, and Food for Budget tells you exactly what to order: the most protein your money can buy, with tax included, and a line to read to the cashier.

Version 1 covers McDonald's only. It is an installable PWA (React + Vite) and the optimizer runs entirely in the browser, so there is no server.

## Run it

```bash
npm install
npm run dev      # local dev server
npm test         # optimizer tests
npm run build    # production build in dist/
```

## Deploy

On [Vercel](https://vercel.com), sign in with GitHub and import this repo. Vercel detects Vite automatically and redeploys on every push to `main`.

## How it works

The order is an integer linear program solved with [javascript-lp-solver](https://github.com/JWally/jsLPSolver) (`src/lib/optimizer.js`):

- **Choose:** a whole-number quantity of each menu item or deal
- **Optimize:** depends on the goal (below)
- **Subject to:** pre-tax cost ≤ budget ÷ (1 + tax rate), optional calorie and carb limits, and each item ≤ its cap (default 3)

| Goal | Optimizes | Required input |
| --- | --- | --- |
| Max protein (default) | Most protein | none |
| Calorie target | Most protein | calories max (default 600) |
| Cheapest meal | Lowest cost | protein at least (default 40 g) |
| Low carb | Most protein | carbs max (default 20 g) |
| Balanced macros | Closest to a protein / carb / fat split of calories | split (default 40/30/30) and a calorie floor (default 500) |
| Most food | Most calories | none |
| Just pick for me | Most calories, from starred favorites, max 2 of each | favorites, calories max (default 1,200) |

Goals are defined in `src/lib/goals.js`. Balanced macros minimizes the total gap, in calories, between each macro and its target share, using one deviation variable per macro.

Diet and allergy filters (`src/lib/filters.js`) work with every goal: vegetarian, no pork, avoid milk / egg / soy / wheat / sesame, and low sodium (whole order under 1,000 mg). The "next best option" re-solves with each item of the best order removed in turn, in case something is out. Every answer is checked against the rules before it is shown, because the solver can occasionally report an impossible program as feasible. `optimizer.exhaustive.test.js` checks the solver against brute force over every possible order (all favorites sets for "Just pick for me", and every goal with and without limits).

## Data

| File | What it holds |
| --- | --- |
| `src/data/menu.json` | Items and deals with price, protein, calories, carbs, fat, sodium, allergens and meat |
| `src/data/settings.json` | Default sales tax (9.25%, Nashville) and quantity cap |
| `src/data/tax-rates.json` | Average combined sales tax per state (Tax Foundation, July 1, 2026), ZIP prefix → state ranges, and local overrides (Nashville 9.25%) |

Prices are national average estimates (October 2026). Users can override them and star favorites on their device. Protein, calories and carbs come from the spec; fat, sodium and allergens come from fastfoodnutrition.org. All nutrition figures are approximate and must be checked against the official McDonald's Nutrition Calculator before launch. Meal Deal nutrition assumes water or a diet drink.

Not affiliated with McDonald's. Not medical or nutrition advice.
