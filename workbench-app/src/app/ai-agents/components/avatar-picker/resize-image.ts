import { InjectionToken } from '@angular/core';

/** Cómo se convierte la foto elegida en avatar; las pruebas ponen otra, porque jsdom no dibuja. */
export const AVATAR_RESIZER = new InjectionToken<(file: Blob) => Promise<string>>(
  'AVATAR_RESIZER',
  {
    factory: () => resizeToAvatar,
  },
);

/** Lado, en píxeles, del cuadrado al que se reduce cada avatar. */
export const AVATAR_SIZE = 256;

/**
 * Recorta la imagen al cuadrado central y la reduce a `AVATAR_SIZE`, como data URL. Así da igual
 * el tamaño de la foto que se suba: el avatar siempre pesa unos pocos KB.
 */
export async function resizeToAvatar(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('El navegador no puede procesar imágenes');
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
    return canvas.toDataURL('image/webp', 0.85);
  } finally {
    bitmap.close();
  }
}
