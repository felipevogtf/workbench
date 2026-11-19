export interface LabelProps {
  id: string;
  name: string;
  color: string | null;
  /** El proyecto (`org/repo`, en minúsculas) al que apunta: de él salen el enlace del repositorio y su receta. */
  projectRepo: string | null;
}
