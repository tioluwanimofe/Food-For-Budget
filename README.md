# Food for Budget

Say "I'm hungry," enter how much you want to spend, and Food for Budget tells you exactly what to order: the most protein your money can buy, with tax included, and a line to read to the cashier.

It covers McDonald's, Taco Bell, Chipotle and Panera Bread. Pick one chain, or "All chains" to plan the best order at each and show the winner (an order always comes from one restaurant), with how the others compare.

"Where" can also be limited to what's near you: **Walk** or **Drive** within 5 to 30 minutes, or **Order in**. The app asks for your location once per visit (it is never saved), finds the nearest location of each chain in OpenStreetMap using the free [Photon](https://photon.komoot.io) search, with [Nominatim](https://nominatim.org) as the backup, and only plans orders at chains in reach. Travel time is an estimate from straight-line distance (+30% for roads, 3 mph walking, 20 mph driving plus 3 minutes to park). Order in reaches chains within 5 miles and models a delivery app as a menu markup (default 20%) plus fees ($5) and a tip ($3), all editable; fees and tip come out of the budget first. The nearest restaurant's ZIP code also fills in the sales tax if you haven't set one. The logic is in `src/lib/nearby.js`. Only a location rounded to about 1 km is sent to the search.

It is an installable PWA (React + Vite) and the optimizer runs entirely in the browser, so there is no server.

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

Diet and allergy filters (`src/lib/filters.js`) work with every goal: vegetarian, no pork, avoid milk / egg / soy / wheat / sesame, and low sodium (whole order under 1,000 mg). The "next best option" re-solves with each item of the best order removed in turn, in case something is out. Items with unknown allergens are left out when any allergen is avoided, and items with unknown sodium when low sodium is on. Every answer is checked against the rules before it is shown, because the solver can occasionally report an impossible program as feasible. `optimizer.exhaustive.test.js` checks the solver against brute force over every possible order (all favorites sets for "Just pick for me", and every goal with and without limits), and `chains.test.js` does the same for every chain's menu.

## Data

| File | What it holds |
| --- | --- |
| `src/data/chains/*.json` | One file per chain: items and deals with price, protein, calories, carbs, fat, sodium, allergens and meat (`null` means unknown), plus price and nutrition notes. `index.js` lists the chains |
| `src/data/settings.json` | Default sales tax (9.25%, Nashville) and quantity cap |
| `src/data/tax-rates.json` | Average combined sales tax per state (Tax Foundation, July 1, 2026), ZIP prefix → state ranges, and local overrides (Nashville 9.25%) |

Prices are national average estimates and vary by location. Users can override them and star favorites on their device.

- **McDonald's:** prices as of October 2026. Protein, calories and carbs come from the spec; fat, sodium and allergens come from fastfoodnutrition.org. Meal Deal nutrition assumes water or a diet drink.
- **Taco Bell:** prices from sixstoreys.com (mid-2025), nutrition from fastfoodnutrition.org.
- **Chipotle:** prices from sixstoreys.com (mid-2025, approximate by protein). Bowls and burritos are built from Chipotle's official US nutrition PDF (March 2025) as protein, white rice, black beans, tomato salsa, cheese and lettuce.
- **Panera Bread:** prices from sixstoreys.com (mid-2025). Calories, fat and protein come from fastfoodnutrition.org; carbs are estimated for many items (`carbsEstimated`), and sodium and allergens are unknown for most.

All nutrition figures are approximate and must be checked against each chain's official nutrition information before launch.

Not affiliated with McDonald's, Taco Bell, Chipotle or Panera Bread. Not medical or nutrition advice.
