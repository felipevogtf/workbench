import type { NavItem } from '@core/navigation/nav-item';

/**
 * «Automatización»: lo que ejecuta una tarea con IA. Los runners (los programas del PC) y los
 * trabajadores: todos los agentes de IA de la app (crean los tickets, desarrollan, revisan, planifican y
 * conversan).
 */
export const EXECUTIONS_NAV: NavItem = {
  label: 'Automatización',
  icon: 'sparkles',
  order: 15,
  children: [
    { label: 'Ejecuciones', icon: 'list-checks', path: '/executions/history' },
    { label: 'Consumo', icon: 'chart-bar', path: '/executions/usage' },
    { label: 'Runners', icon: 'play', path: '/executions/runners' },
    { label: 'Trabajadores', icon: 'bot', path: '/executions/agents' },
  ],
};
