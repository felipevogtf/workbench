import type { NavItem } from '@core/navigation/nav-item';

/**
 * «Trabajadores»: lo que ejecuta una tarea con IA. Los runners (los programas del PC) y los agentes
 * que crean los tickets, desarrollan y revisan. Los agentes de siempre siguen en «Agentes de IA».
 */
export const EXECUTIONS_NAV: NavItem = {
  label: 'Trabajadores',
  icon: 'sparkles',
  order: 15,
  children: [
    { label: 'Runners', icon: 'play', path: '/executions/runners' },
    { label: 'Agentes', icon: 'bot', path: '/executions/agents' },
  ],
};
