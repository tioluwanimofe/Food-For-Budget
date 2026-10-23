import { CHAINS } from '../data/chains/index.js';
import { ALLERGENS } from '../lib/filters.js';
import { GOALS, GOAL_IDS } from '../lib/goals.js';

export default function BudgetForm({
  form,
  onChange,
  onSubmit,
  taxRate,
  onTaxRate,
  taxLabel,
  zip,
  onZip,
  cap,
  onCap,
  onEditMenu,
  favoriteCount,
  filters,
  onFilters,
  chain,
  onChain,
}) {
  const set = (key) => (e) => onChange({ ...form, [key]: e.target.value });
  const goal = GOALS[form.goal];
  const targets = goal.targets ?? [];
  const targetKeys = targets.map((t) => t.key);
  const budgetOk = Number(form.budget) > 0;
  const targetOk = targets.every((t) => Number(form[t.key]) >= 0 && form[t.key] !== '');
  const toggleFilter = (key) => onFilters({ ...filters, [key]: !filters[key] });
  const toggleAvoid = (a) =>
    onFilters({ ...filters, avoid: filters.avoid.includes(a) ? filters.avoid.filter((x) => x !== a) : [...filters.avoid, a] });
  const activeFilters = ['vegetarian', 'noPork', 'lowSodium'].filter((k) => filters[k]).length + filters.avoid.length;

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
        <legend>Where</legend>
        {[{ id: 'all', name: 'All chains' }, ...CHAINS].map((c) => (
          <label key={c.id} className={`chip${chain === c.id ? ' selected' : ''}`}>
            <input type="radio" name="chain" value={c.id} checked={chain === c.id} onChange={() => onChain(c.id)} />
            {c.name}
          </label>
        ))}
        <p className="fine blurb">
          {chain === 'all' ? 'Checks every chain and picks the one that does best. The order comes from one place.' : 'Only this menu.'}
        </p>
      </fieldset>

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

      {targets.length > 0 && (
        <div className={targets.length > 1 ? 'targets multi' : 'targets'}>
          {targets.map((t) => (
            <label key={t.key} className="target">
              {t.label}
              <span className="unit-input">
                <input type="number" inputMode="numeric" min="0" value={form[t.key]} onChange={set(t.key)} required />
                <span>{t.unit}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      <details className="options">
        <summary>Diet and allergy filters{activeFilters > 0 && ` (${activeFilters} on)`}</summary>
        <div className="filters">
          <label className={`chip small${filters.vegetarian ? ' selected' : ''}`}>
            <input type="checkbox" checked={filters.vegetarian} onChange={() => toggleFilter('vegetarian')} /> Vegetarian
          </label>
          <label className={`chip small${filters.noPork ? ' selected' : ''}`}>
            <input type="checkbox" checked={filters.noPork} onChange={() => toggleFilter('noPork')} /> No pork
          </label>
          <label className={`chip small${filters.lowSodium ? ' selected' : ''}`}>
            <input type="checkbox" checked={filters.lowSodium} onChange={() => toggleFilter('lowSodium')} /> Low sodium
          </label>
        </div>
        <p className="fine">Avoid:</p>
        <div className="filters">
          {ALLERGENS.map((a) => (
            <label key={a} className={`chip small${filters.avoid.includes(a) ? ' selected' : ''}`}>
              <input type="checkbox" checked={filters.avoid.includes(a)} onChange={() => toggleAvoid(a)} /> No {a}
            </label>
          ))}
        </div>
        <p className="fine">
          Low sodium keeps the whole order under 1,000 mg. Allergen info is approximate and kitchens share fryers and
          grills, so check with the restaurant if an allergy is serious.
        </p>
      </details>

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
          {!targetKeys.includes('calorieLimit') && (
            <label>
              Calorie limit
              <input type="number" inputMode="numeric" min="0" placeholder="None" value={form.calorieLimit} onChange={set('calorieLimit')} />
            </label>
          )}
          {!targetKeys.includes('carbLimit') && (
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
            ZIP code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength="5"
              placeholder="e.g. 37203"
              value={zip}
              onChange={(e) => onZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            />
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
        <p className="fine">
          Tax: {taxLabel}. Restaurant meals can be taxed at a different rate, so edit it if your receipt differs.
        </p>
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
