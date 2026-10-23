import { useCallback, useEffect, useMemo, useState } from 'react';
import menu from './data/menu.json';
import defaults from './data/settings.json';
import { planOrder } from './lib/optimizer.js';
import { loadSaved, save } from './lib/storage.js';
import BudgetForm from './components/BudgetForm.jsx';
import MysteryBox from './components/MysteryBox.jsx';
import OrderCard from './components/OrderCard.jsx';
import PriceEditor from './components/PriceEditor.jsx';

export default function App() {
  const saved = useMemo(loadSaved, []);
  const [prices, setPrices] = useState(saved.prices ?? {});
  const [taxRate, setTaxRate] = useState(saved.taxRate ?? defaults.taxRate);
  const [cap, setCap] = useState(saved.cap ?? defaults.quantityCap);
  const [form, setForm] = useState({ budget: 10, calorieLimit: '', carbLimit: '' });
  const [plan, setPlan] = useState(null);
  const [phase, setPhase] = useState('form'); // form | reveal | result
  const [showPrices, setShowPrices] = useState(false);

  useEffect(() => save({ prices, taxRate, cap }), [prices, taxRate, cap]);

  const items = useMemo(
    () => menu.items.map((i) => ({ ...i, price: prices[i.id] ?? i.price, edited: i.id in prices })),
    [prices],
  );

  const revealDone = useCallback(() => setPhase('result'), []);

  function feedMe() {
    setPlan(
      planOrder(items, {
        budget: Number(form.budget),
        taxRate,
        cap,
        calorieLimit: Number(form.calorieLimit) || undefined,
        carbLimit: Number(form.carbLimit) || undefined,
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
            onTaxRate={setTaxRate}
            cap={cap}
            onCap={setCap}
            onEditPrices={() => setShowPrices(true)}
          />
        )}
        {phase === 'reveal' && <MysteryBox onDone={revealDone} />}
        {phase === 'result' && <OrderCard plan={plan} taxRate={taxRate} onBack={() => setPhase('form')} />}
      </main>

      {showPrices && (
        <PriceEditor items={items} prices={prices} onChange={setPrices} onClose={() => setShowPrices(false)} />
      )}

      <footer>
        <p>{menu.priceNote}</p>
        <p>Not affiliated with McDonald's. Not medical or nutrition advice.</p>
      </footer>
    </div>
  );
}
