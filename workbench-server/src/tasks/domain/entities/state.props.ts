export interface StateProps {
  id: string;
  name: string;
  color: string | null;
  position: number;
  /** Una tarea en este estado está finalizada: no aparece entre los pendientes. */
  isFinal: boolean;
}
