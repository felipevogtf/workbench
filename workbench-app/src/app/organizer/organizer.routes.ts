import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';

/** `/organizer` (un chat nuevo) y `/organizer/:id` (una conversación) son la misma pantalla: así pasar de una a otra no la recrea. */
function conversation(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length > 1) return null;
  return {
    consumed: segments,
    posParams: segments.length === 1 ? { id: segments[0] } : {},
  };
}

export const ORGANIZER_ROUTES: Routes = [
  {
    matcher: conversation,
    title: 'Organizador · Workbench',
    // El chat usa todo el ancho, con el menú como panel flotante (como un tablero).
    data: { immersive: true },
    loadComponent: () =>
      import('./pages/organizer-page/organizer-page').then((m) => m.OrganizerPage),
  },
];
