import { WorkedProject } from './group-by-project';

/** Lo desarrollado frente a lo estimado, solo en los tickets que tienen estimado. */
export interface EstimateComparison {
  /** Suma de los estimados de los tickets trabajados que tienen uno. */
  estimatedHours: number;
  /** Lo desarrollado en esos mismos tickets: así la comparación es pareja. */
  workedHours: number;
  /** Cuántos tickets trabajados tienen estimado, y cuántos se trabajaron en total. */
  estimatedTickets: number;
  tickets: number;
}

/** Evita arrastrar errores de coma flotante al sumar horas decimales. */
const round = (hours: number) => Math.round(hours * 100) / 100;

export function compareToEstimate(projects: readonly WorkedProject[]): EstimateComparison {
  let estimatedHours = 0;
  let workedHours = 0;
  let estimatedTickets = 0;
  let tickets = 0;

  for (const project of projects) {
    for (const issue of project.issues) {
      tickets++;
      if (issue.estimatedHours === null) continue;
      estimatedTickets++;
      estimatedHours += issue.estimatedHours;
      workedHours += issue.hours;
    }
  }

  return {
    estimatedHours: round(estimatedHours),
    workedHours: round(workedHours),
    estimatedTickets,
    tickets,
  };
}
