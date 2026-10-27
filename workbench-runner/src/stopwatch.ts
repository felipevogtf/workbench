/**
 * Mide en qué fase se va el tiempo de un trabajo (carpeta, entorno, IA, limpieza…): `lap` cierra la fase que corría y
 * `summary` las junta en una línea para el registro del trabajo.
 */
export function stopwatch(now: () => number = Date.now) {
  const start = now();
  let last = start;
  const laps: [string, number][] = [];
  return {
    lap(name: string): void {
      const at = now();
      laps.push([name, at - last]);
      last = at;
    },
    summary(): string {
      const total = now() - start;
      const parts = laps.map(([name, ms]) => `${name} ${seconds(ms)}`);
      return `⏱ ${seconds(total)} en total: ${parts.join(' · ')}`;
    },
  };
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}
