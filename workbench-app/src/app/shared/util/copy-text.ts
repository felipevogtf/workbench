/**
 * Copia texto al portapapeles. `navigator.clipboard` solo existe en contextos seguros (HTTPS o
 * localhost); en otros, o si el permiso falla, se usa `execCommand('copy')` como alternativa.
 */
export async function copyText(text: string): Promise<void> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // cae al método alternativo
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    if (!document.execCommand('copy')) throw new Error('copy command rejected');
  } finally {
    area.remove();
  }
}
