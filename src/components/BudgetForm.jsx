export default function BudgetForm({ form, onChange, onSubmit, taxRate, onTaxRate, cap, onCap, onEditPrices }) {
  const set = (key) => (e) => onChange({ ...form, [key]: e.target.value });
  const budgetOk = Number(form.budget) > 0;

  return (
    <form
      className="card form"
      onSubmit={(e) => {
        e.preventDefault();
        if (budgetOk) onSubmit();
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
        <label className="chip selected">
          <input type="radio" name="goal" value="protein" defaultChecked /> Max protein
        </label>
      </fieldset>

      <details className="options">
        <summary>Limits and settings</summary>
        <div className="grid">
          <label>
            Calorie limit
            <input type="number" inputMode="numeric" min="0" placeholder="None" value={form.calorieLimit} onChange={set('calorieLimit')} />
          </label>
          <label>
            Carb limit (g)
            <input type="number" inputMode="numeric" min="0" placeholder="None" value={form.carbLimit} onChange={set('carbLimit')} />
          </label>
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
        <button type="button" className="link" onClick={onEditPrices}>
          Edit local prices
        </button>
      </details>

      <button type="submit" className="feed" disabled={!budgetOk}>
        Feed me
      </button>
    </form>
  );
}
