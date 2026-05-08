import { setFastForward, getFastForward } from '../render/animations.js';

let mounted = false;

export function mountKeyboard(): void {
  if (mounted) return;
  mounted = true;
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      setFastForward(!getFastForward());
    } else if (e.key === 'Escape') {
      const overlays = document.querySelectorAll('.overlay-backdrop');
      const top = overlays[overlays.length - 1];
      top?.remove();
    }
  });

  // Reduced motion: auto-set fastForward when prefers-reduced-motion: reduce
  const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (mql?.matches) setFastForward(true);
}
