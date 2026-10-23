export default function MenuEditor({ menus, prices, onPrices, favorites, onFavorites, onClose }) {
  function setPrice(id, value) {
    const next = { ...prices };
    const n = Number(value);
    if (value === '' || !(n > 0)) delete next[id];
    else next[id] = n;
    onPrices(next);
  }

  function toggleFavorite(id) {
    onFavorites(favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id]);
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="menu-title">
      <div className="card">
        <h2 id="menu-title">Your menu</h2>
        <p className="fine">
          Star your favorites for "Just pick for me". Starting prices are national average estimates; change any that
          differ near you. Everything is saved on this device.
        </p>
        {menus.map(({ chain, items }) => (
          <section key={chain.id}>
            {menus.length > 1 && <h3 className="chain-name">{chain.name}</h3>}
            <ul className="prices">
              {items.map((item) => {
                const fav = favorites.includes(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`star${fav ? ' on' : ''}`}
                      aria-pressed={fav}
                      aria-label={`Favorite ${item.name}`}
                      onClick={() => toggleFavorite(item.id)}
                    >
                      {fav ? '★' : '☆'}
                    </button>
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
                );
              })}
            </ul>
          </section>
        ))}
        <div className="row">
          <button type="button" className="link" onClick={() => { onPrices({}); onClose(); }}>
            Reset prices
          </button>
          <button type="button" className="feed" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
