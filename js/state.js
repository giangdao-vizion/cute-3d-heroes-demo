const KEY = 'cute3d.selection.v1';
const DEFAULT = {
  hero: 'Knight', pet: 'ShibaInu', boss: 'Trex',
  monsters: ['Skeleton_Minion', 'Enemy', 'Frog', 'Rat', 'Spider', 'Bee'],
};
let saved = null;
try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { /* bỏ qua */ }
export const selection = Object.assign(structuredClone(DEFAULT), saved || {});
export function saveSelection() { localStorage.setItem(KEY, JSON.stringify(selection)); }
