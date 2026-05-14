export async function showFlavorBanner(message: string, ms = 1500): Promise<void> {
  const el = document.createElement('div');
  el.className = 'flavor-banner';
  el.textContent = message;
  document.body.appendChild(el);
  await new Promise((r) => setTimeout(r, ms));
  el.remove();
}
