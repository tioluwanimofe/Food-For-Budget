import { useCallback, useEffect, useMemo, useState } from 'react';
import menu from './data/menu.json';
import defaults from './data/settings.json';
import { GOALS } from './lib/goals.js';
import { planOrder } from './lib/optimizer.js';
import { taxForZip } from './lib/tax.js';
import { loadSaved, save } from './lib/storage.js';
import BudgetForm from './components/BudgetForm.jsx';
import MysteryBox from './components/MysteryBox.jsx';
import OrderCard from './components/OrderCard.jsx';
import MenuEditor from './components/MenuEditor.jsx';

export default function App() {
  const saved = useMemo(loadSaved, []);
  const [prices, setPrices] = useState(saved.prices ?? {});
  const [taxRate, setTaxRate] = useState(saved.taxRate ?? defaults.taxRate);
  const [taxLabel, setTaxLabel] = useState(saved.taxLabel ?? `${defaults.taxLabel}, default`);
  const [zip, setZip] = useState(saved.zip ?? '');
  const [cap, setCap] = useState(saved.cap ?? defaults.quantityCap);
  const [favorites, setFavorites] = useState(saved.favorites ?? []);
  const [form, setForm] = useState({ budget: 10, goal: saved.goal ?? 'protein', calorieLimit: '', carbLimit: '', proteinMin: '' });
  const [plan, setPlan] = useState(null);
  const [phase, setPhase] = useState('form'); // form | reveal | result
  const [showMenu, setShowMenu] = useState(false);

  useEffect(
    () => save({ prices, taxRate, taxLabel, zip, cap, favorites, goal: form.goal }),
    [prices, taxRate, taxLabel, zip, cap, favorites, form.goal],
  );

  function changeZip(value) {
    setZip(value);
    const tax = taxForZip(value);
    if (tax) {
      setTaxRate(tax.rate);
      setTaxLabel(`${(tax.rate * 100).toFixed(2)}%, ${tax.label} (estimate)`);
    } else if (value.length === 5) {
      setTaxLabel('ZIP not recognized, enter the rate by hand');
    }
  }

  function changeTaxRate(rate) {
    setTaxRate(rate);
    setTaxLabel('set by you');
  }

  // Prefill the selected goal's target with its default the first time it is picked.
  useEffect(() => {
    const target = GOALS[form.goal].target;
    if (target) setForm((f) => (f[target.key] === '' ? { ...f, [target.key]: target.default } : f));
  }, [form.goal]);

  const items = useMemo(
    () =>
      menu.items.map((i) => ({
        ...i,
        price: prices[i.id] ?? i.price,
        edited: i.id in prices,
        favorite: favorites.includes(i.id),
      })),
    [prices, favorites],
  );

  const revealDone = useCallback(() => setPhase('result'), []);

  function feedMe() {
    setPlan(
      planOrder(items, {
        goal: form.goal,
        budget: Number(form.budget),
        taxRate,
        cap,
        calorieLimit: Number(form.calorieLimit) || undefined,
        carbLimit: Number(form.carbLimit) || undefined,
        proteinMin: GOALS[form.goal].target?.key === 'proteinMin' ? Number(form.proteinMin) || undefined : undefined,
      }),
    );
    setPhase('reveal');
  }

  return (
    <div className="app">
      <header className="brand">
        <img src="/icon.svg" alt="" width="40" height="40" />
        <h1>
          Food for <span>Budget</span>
        </h1>
      </header>

      <main>
        {phase === 'form' && (
          <BudgetForm
            form={form}
            onChange={setForm}
            onSubmit={feedMe}
            taxRate={taxRate}
            onTaxRate={changeTaxRate}
            taxLabel={taxLabel}
            zip={zip}
            onZip={changeZip}
            cap={cap}
            onCap={setCap}
            onEditMenu={() => setShowMenu(true)}
            favoriteCount={favorites.length}
          />
        )}
        {phase === 'reveal' && <MysteryBox onDone={revealDone} />}
        {phase === 'result' && <OrderCard plan={plan} goal={form.goal} taxRate={taxRate} onBack={() => setPhase('form')} />}
      </main>

      {showMenu && (
        <MenuEditor
          items={items}
          prices={prices}
          onPrices={setPrices}
          favorites={favorites}
          onFavorites={setFavorites}
          onClose={() => setShowMenu(false)}
        />
      )}

      <footer>
        <p>{menu.priceNote}</p>
        <p>Not affiliated with McDonald's. Not medical or nutrition advice.</p>
      </footer>
    </div>
  );
}
