/** Una tarea miembro de un grupo, con su texto ya en texto plano. */
export interface GroupMemberText {
  /** El código de Plane (`MEL-12`); `null` si no lo tiene. */
  key: string | null;
  name: string;
  description: string | null;
}

/**
 * La descripción de un grupo de tareas, que es lo que lee el planificador y lo que reciben los agentes: las notas del grupo (qué
 * depende de qué, lo que el usuario quiso dejar dicho) y una sección por tarea, en el orden en que se hacen.
 */
export function composeGroupDescription(
  notes: string | null,
  members: readonly GroupMemberText[],
): string {
  return [
    `Este es un grupo de ${members.length} tareas relacionadas, que se planifican y se ejecutan juntas: una sola rama y una pull request por repositorio.`,
    'Se hacen en el orden en que aparecen; cada una puede apoyarse en lo que crean las anteriores. Cada tarea tiene sus propios criterios de aceptación y todos se deben cumplir.',
    ...(notes?.trim() ? ['', '## Notas del grupo', notes.trim()] : []),
    ...members.flatMap((member, index) => [
      '',
      `## ${index + 1}. ${member.key ? `${member.key} — ` : ''}${member.name}`,
      member.description?.trim() || '(sin descripción)',
    ]),
  ].join('\n');
}
