export function renderShell(root: HTMLElement): void {
  if (root.querySelector('.shell')) return; // idempotent
  root.innerHTML = `
    <div class="shell">
      <header class="top-bar">
        <div class="top-left"></div>
        <div class="top-center"></div>
        <div class="top-right"></div>
      </header>
      <main class="board-host"></main>
      <footer class="bottom-bar">
        <div class="pills"></div>
        <div class="actions"></div>
      </footer>
    </div>
  `;
}
