import { CHAINS } from '../data/chains/index.js';
import { MODES, MODE_IDS, TIME_LIMITS, inReach, travelMinutes } from '../lib/nearby.js';

const ERRORS = {
  denied: 'Location is blocked. Allow it for this site in your browser settings, or choose Anywhere.',
  unavailable: "Couldn't get your location. Try again, or choose Anywhere.",
  unsupported: "This browser can't share a location. Choose Anywhere instead.",
  search: "Couldn't reach the map search. Check your connection and try again.",
};

export function placeLabel(place, mode) {
  const miles = `${place.miles < 10 ? place.miles.toFixed(1) : Math.round(place.miles)} mi`;
  const min = travelMinutes(place.miles, mode);
  return min ? `${miles} · about ${min} min ${MODES[mode].verb}` : miles;
}

export default function NearbyPicker({ access, onAccess, delivery, onDelivery, near, onLocate }) {
  const { mode, minutes } = access;
  const setDelivery = (key) => (e) => onDelivery({ ...delivery, [key]: e.target.value });

  return (
    <div className="nearby">
      <div className="filters" role="radiogroup" aria-label="How you'll get food">
        {MODE_IDS.map((id) => (
          <label key={id} className={`chip small${mode === id ? ' selected' : ''}`}>
            <input type="radio" name="mode" value={id} checked={mode === id} onChange={() => onAccess({ ...access, mode: id })} />
            {MODES[id].label}
          </label>
        ))}
      </div>

      {(mode === 'walk' || mode === 'drive') && (
        <div className="filters" role="radiogroup" aria-label="Time to get there">
          <span className="fine">Within</span>
          {TIME_LIMITS.map((t) => (
            <label key={t} className={`chip small${minutes === t ? ' selected' : ''}`}>
              <input type="radio" name="minutes" value={t} checked={minutes === t} onChange={() => onAccess({ ...access, minutes: t })} />
              {t} min
            </label>
          ))}
        </div>
      )}

      {mode === 'delivery' && (
        <div className="grid three">
          <label>
            Menu markup (%)
            <input type="number" inputMode="numeric" min="0" max="100" value={delivery.markup} onChange={setDelivery('markup')} />
          </label>
          <label>
            Fees ($)
            <input type="number" inputMode="decimal" min="0" step="0.01" value={delivery.fees} onChange={setDelivery('fees')} />
          </label>
          <label>
            Tip ($)
            <input type="number" inputMode="decimal" min="0" step="0.01" value={delivery.tip} onChange={setDelivery('tip')} />
          </label>
        </div>
      )}

      {mode !== 'any' && (
        <>
          {near.status === 'ready' ? (
            <ul className="near-list">
              {CHAINS.map((c) => {
                const p = near.nearest[c.id];
                const ok = p && inReach(p, mode, minutes);
                return (
                  <li key={c.id} className={ok ? undefined : 'out'}>
                    <strong>{c.name}</strong>
                    <span className="fine">{p ? placeLabel(p, mode) : 'None within 10 mi'}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="fine">
              {near.status === 'locating' && 'Finding you…'}
              {near.status === 'searching' && 'Looking for restaurants nearby…'}
              {near.status === 'error' && ERRORS[near.error]}
              {near.status === 'idle' && 'Share your location to see which restaurants you can reach.'}
            </p>
          )}
          <button type="button" className="link" onClick={onLocate} disabled={near.status === 'locating' || near.status === 'searching'}>
            {near.status === 'ready' ? 'Update my location' : 'Use my location'}
          </button>
          {mode === 'delivery' && (
            <p className="fine">
              Delivery apps usually charge more than the menu, plus fees and a tip. These come out of your budget first.
              Edit them to match your app.
            </p>
          )}
        </>
      )}
    </div>
  );
}
