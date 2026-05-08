const TABS = [
  { id: 'force', label: 'Force Count' },
  { id: 'stockpiles', label: 'Stockpiles' },
  { id: 'save-map', label: 'Save Map' },
  { id: 'boat', label: 'Boat Info' },
] as const;

export type TabId = typeof TABS[number]['id'];

let mounted = false;
let active: TabId = 'force';

export function mountDrawer(): void {
  if (document.querySelector('.scouting-drawer')) return;
  mounted = true;
  const dr = document.createElement('aside');
  dr.className = 'scouting-drawer';
  dr.innerHTML = `
    <div class="tab-strip">
      ${TABS.map((t) => `<button class="tab" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div class="tab-panels">
      ${TABS.map((t) => `<div class="tab-panel" data-panel="${t.id}"></div>`).join('')}
    </div>`;
  document.body.appendChild(dr);
  dr.querySelectorAll<HTMLButtonElement>('.tab').forEach((b) =>
    b.addEventListener('click', () => setActiveTab(b.dataset.tab as TabId)));
  setActiveTab(active);
}

export function toggleDrawer(): void {
  if (!mounted) mountDrawer();
  document.querySelector('.scouting-drawer')?.classList.toggle('open');
}

export function setActiveTab(id: TabId): void {
  active = id;
  document.querySelectorAll<HTMLElement>('.scouting-drawer .tab').forEach((t) => {
    if (t.dataset.tab === id) t.setAttribute('data-active', 'true');
    else t.removeAttribute('data-active');
  });
  document.querySelectorAll<HTMLElement>('.scouting-drawer .tab-panel').forEach((p) => {
    p.style.display = p.dataset.panel === id ? 'block' : 'none';
  });
}

export function getActiveTab(): TabId { return active; }
