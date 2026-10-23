import { GOALS, GOAL_IDS } from '../lib/goals.js';

export default function BudgetForm({ form, onChange, onSubmit, taxRate, onTaxRate, cap, onCap, onEditMenu, favoriteCount }) {
  const set = (key) => (e) => onChange({ ...form, [key]: e.target.value });
  const goal = GOALS[form.goal];
  const target = goal.target;
  const budgetOk = Number(form.budget) > 0;
  const targetOk = !target || Number(form[target.key]) > 0;

  return (
    <form
      className="card form"
      onSubmit={(e) => {
        e.preventDefault();
        if (budgetOk && targetOk) onSubmit();
      }}
    >
      <label className="budget">
        <span>I'm hungry and I have</span>
        <div className="money">
          <span aria-hidden="true">$</span>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="0.01"
            value={form.budget}
            onChange={set('budget')}
            aria-label="Budget in dollars, including tax"
            required
          />
        </div>
      </label>

      <fieldset className="goal">
        <legend>Goal</legend>
        {GOAL_IDS.map((id) => (
          <label key={id} className={`chip${form.goal === id ? ' selected' : ''}`}>
            <input type="radio" name="goal" value={id} checked={form.goal === id} onChange={set('goal')} />
            {GOALS[id].label}
          </label>
        ))}
        <p className="fine blurb">{goal.blurb}.</p>
      </fieldset>

      {target && (
        <label className="target">
          {target.label}
          <span className="unit-input">
            <input type="number" inputMode="numeric" min="1" value={form[target.key]} onChange={set(target.key)} required />
            <span>{target.unit}</span>
          </span>
        </label>
      )}

      {goal.favoritesOnly && (
        <p className="fine">
          {favoriteCount > 0 ? `Picking from your ${favoriteCount} favorite${favoriteCount > 1 ? 's' : ''}. ` : 'Star a few favorites first. '}
          <button type="button" className="link" onClick={onEditMenu}>
            {favoriteCount > 0 ? 'Change favorites' : 'Pick favorites'}
          </button>
        </p>
      )}

      <details className="options">
        <summary>Limits and settings</summary>
        <div className="grid">
          {target?.key !== 'calorieLimit' && (
            <label>
              Calorie limit
              <input type="number" inputMode="numeric" min="0" placeholder="None" value={form.calorieLimit} onChange={set('calorieLimit')} />
            </label>
          )}
          {target?.key !== 'carbLimit' && (
            <label>
              Carb limit (g)
              <input type="number" inputMode="numeric" min="0" placeholder="None" value={form.carbLimit} onChange={set('carbLimit')} />
            </label>
          )}
          <label>
            Max of each item
            <input type="number" inputMode="numeric" min="1" max="10" value={cap} onChange={(e) => onCap(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <label>
            Sales tax (%)
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="20"
              step="0.01"
              value={+(taxRate * 100).toFixed(3)}
              onChange={(e) => onTaxRate(Math.max(0, Number(e.target.value) || 0) / 100)}
            />
          </label>
        </div>
        <button type="button" className="link" onClick={onEditMenu}>
          Edit prices and favorites
        </button>
      </details>

      <button type="submit" className="feed" disabled={!budgetOk || !targetOk}>
        Feed me
      </button>
    </form>
  );
}
