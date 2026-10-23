import type { NavItem } from '@core/navigation/nav-item';

/**
 * «Automatización»: lo que ejecuta una tarea con IA. Los runners (los programas del PC) y los
 * trabajadores (los agentes que crean los tickets, desarrollan y revisan). Los agentes de siempre
 * siguen en «Agentes de IA».
 */
export const EXECUTIONS_NAV: NavItem = {
  label: 'Automatización',
  icon: 'sparkles',
  order: 15,
  children: [
    { label: 'Runners', icon: 'play', path: '/executions/runners' },
    { label: 'Trabajadores', icon: 'bot', path: '/executions/agents' },
  ],
};
