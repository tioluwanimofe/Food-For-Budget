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
- **Maximize:** total protein
- **Subject to:** pre-tax cost ≤ budget ÷ (1 + tax rate), optional calorie and carb limits, and each item ≤ its cap (default 3)

The "next best option" re-solves with each item of the best order removed in turn, in case something is out.

## Data

| File | What it holds |
| --- | --- |
| `src/data/menu.json` | Items and deals with price, protein, calories and carbs |
| `src/data/settings.json` | Default sales tax (9.25%, Nashville) and quantity cap |

Prices are national average estimates (October 2026) and users can override them on their device. Nutrition figures are approximate and must be checked against the official McDonald's Nutrition Calculator before launch. Meal Deal nutrition assumes water or a diet drink.

Not affiliated with McDonald's. Not medical or nutrition advice.
