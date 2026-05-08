import type { GameState } from '../../game/types.js';
import { encodeMap } from '../../game/mapTextCodec.js';

export function renderSaveMapTab(state: GameState): void {
  const host = document.querySelector<HTMLElement>('.tab-panel[data-panel="save-map"]');
  if (!host) return;
  const text = encodeMap(state.squares);
  host.innerHTML = `
    <textarea class="map-text" rows="12" readonly>${text}</textarea>
    <button class="btn-copy-map act">Copy to clipboard</button>`;
  host.querySelector('.btn-copy-map')!.addEventListener('click', () => {
    const ta = host.querySelector<HTMLTextAreaElement>('.map-text')!;
    navigator.clipboard?.writeText(ta.value).catch(() => { ta.select(); });
  });
}
