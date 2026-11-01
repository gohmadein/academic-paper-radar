// Rotate only when a new distinct published issue is added after this anchor.
// No wall clock, selected-date filter, randomness or browser-local state involved.
export const LI_BACKGROUND_ANCHOR = '2026-11-01';
export function liBackgroundSlot(days = []) {
  const subsequent = new Set(days.map(day => day.date).filter(date =>
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && date > LI_BACKGROUND_ANCHOR));
  return subsequent.size % 2;
}
export function liBackgroundClass(state, days = []) {
  return state.view === 'feed' && state.category === 'li' && !state.demo && days.length
    ? `li-background-${liBackgroundSlot(days)}` : '';
}
