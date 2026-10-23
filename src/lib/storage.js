// Per-device settings (local prices, tax rate, cap). Storage can be missing or
// blocked (private mode), so every access is guarded and falls back to defaults.
const KEY = 'ffb:settings:v1';

export function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

export function save(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Not persisted; the app still works for this visit.
  }
}
