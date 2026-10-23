export default function PriceEditor({ items, prices, onChange, onClose }) {
  function setPrice(id, value) {
    const next = { ...prices };
    const n = Number(value);
    if (value === '' || !(n > 0)) delete next[id];
    else next[id] = n;
    onChange(next);
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="prices-title">
      <div className="card">
        <h2 id="prices-title">Local prices</h2>
        <p className="fine">Starting prices are national average estimates. Change any that differ at your McDonald's; they're saved on this device.</p>
        <ul className="prices">
          {items.map((item) => (
            <li key={item.id}>
              <label htmlFor={`p-${item.id}`}>{item.name}</label>
              <div className="money small">
                <span aria-hidden="true">$</span>
                <input
                  id={`p-${item.id}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  defaultValue={item.price.toFixed(2)}
                  onChange={(e) => setPrice(item.id, e.target.value)}
                  className={item.edited ? 'edited' : ''}
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="row">
          <button type="button" className="link" onClick={() => { onChange({}); onClose(); }}>
            Reset to estimates
          </button>
          <button type="button" className="feed" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
