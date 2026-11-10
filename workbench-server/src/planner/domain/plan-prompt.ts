import type { StagedAttachment } from '@core/attachments/attachments';
import { conversationLines } from './conversation';
import { PlanChatMessage, PlanRepoInfo } from './entities/plan.props';
import { TicketData } from './ports/tickets-gateway.port';
import { TaskContext } from './ports/tasks-gateway.port';

/** La descripción se recorta para no pasar el límite de argumentos de los CLI que reciben el prompt así. */
export const MAX_DESCRIPTION_CHARS = 6000;
/** Del plan anterior y de la conversación entra lo que quepa: el resto se recorta (lo último pesa más). */
export const MAX_PREVIOUS_PLAN_CHARS = 30_000;
export const MAX_REVISION_CONVERSATION_CHARS = 40_000;

/** Lo que se agrega al pedir una replanificación: el plan anterior (solo uno) y lo conversado con el usuario. */
export interface PlanRevision {
  /** Markdown del plan del que se parte; null si ya no existe o nunca hubo uno. */
  previousPlan: string | null;
  conversation: readonly PlanChatMessage[];
  /** Dónde quedó cada adjunto de la conversación, para que el agente los lea. */
  staged?: ReadonlyMap<string, StagedAttachment>;
  /**
   * `patch` (lo normal si hay plan anterior): la IA responde solo con los fragmentos que cambian, en bloques de edición que el
   * servidor aplica. `full`: entrega el plan completo (sin plan anterior, o cuando los bloques no se pudieron aplicar).
   */
  mode?: 'patch' | 'full';
  /** Por qué falló el intento anterior de aplicar sus bloques; se le dice a la IA para que lo corrija. */
  patchError?: string;
}

export interface PlanPromptInput {
  task: TaskContext;
  tickets: TicketData[];
  repos: PlanRepoInfo[];
  /** Presente solo en una replanificación. */
  revision?: PlanRevision | null;
}

export function truncate(text: string, max: number): string {
  return text.length > max
    ? `${text.slice(0, max)}\n[…descripción recortada…]`
    : text;
}

/** Los datos de la tarea: título, proyecto, estado, etiquetas… y su descripción. */
export function taskLines(task: TaskContext): string[] {
  const lines: string[] = [`**Título:** ${task.name}`];

  const facts: [string, string | number | null][] = [
    ['Proyecto', task.projectName],
    ['Estado', task.stateName],
    [
      'Prioridad',
      task.priority && task.priority !== 'none' ? task.priority : null,
    ],
    ['Inicio', task.startDate],
    ['Vencimiento', task.dueDate],
    ['Etiquetas', task.labels.map((label) => label.name).join(', ') || null],
  ];
  for (const [label, value] of facts) {
    if (value !== null && value !== '') lines.push(`**${label}:** ${value}`);
  }

  lines.push('', '## Descripción', '');
  lines.push(
    task.description?.trim()
      ? truncate(task.description.trim(), MAX_DESCRIPTION_CHARS)
      : '(La tarea no tiene descripción.)',
  );
  return lines;
}

/** Lo que hay que saber cuando la tarea es un grupo de tareas relacionadas: un solo plan para todas. */
export function groupLines(task: TaskContext): string[] {
  if (task.members.length === 0) return [];
  return [
    '',
    '## Es un grupo de tareas',
    '',
    `Esta tarea reúne a ${task.members.length} tareas relacionadas (arriba, en el orden en que se hacen). Haz UN solo plan para todas: ordena los pasos por dependencias, rotula cada paso con la tarea a la que pertenece, di qué repositorio toca cada uno (el que otros consumen va antes, por ejemplo el backend antes que la app que lo llama) y no mezcles en un mismo paso cambios de tareas distintas. Comprueba que cada criterio de aceptación de cada tarea quede cubierto por algún paso.`,
  ];
}

/** Los tickets de Plane leídos, cada uno con su estado, etiquetas y descripción. */
export function ticketLines(tickets: TicketData[], heading: string): string[] {
  if (tickets.length === 0) return [];

  const lines = ['', heading, ''];
  for (const ticket of tickets) {
    const meta = [
      ticket.stateName,
      ticket.priority && ticket.priority !== 'none' ? ticket.priority : null,
      ticket.labels.length > 0 ? ticket.labels.join(', ') : null,
    ]
      .filter(Boolean)
      .join(' · ');
    lines.push(`### ${ticket.key}: ${ticket.title}${meta ? ` (${meta})` : ''}`);
    if (ticket.descriptionText?.trim())
      lines.push('', ticket.descriptionText.trim());
    lines.push('');
  }
  return lines;
}

/** Los repositorios que el agente puede leer y los que no se pudieron clonar. */
export function repoLines(repos: PlanRepoInfo[]): string[] {
  const lines: string[] = ['', '## Repositorios', ''];
  const used = repos.filter((repo) => repo.used);
  if (used.length > 0) {
    lines.push(
      'Puedes leer el código de estos repositorios (rama principal, solo lectura). Cada uno está en su carpeta, dentro del directorio actual:',
      '',
      ...used.map((repo) => `- \`${repo.name}/\` — ${repo.url}`),
    );
  } else {
    lines.push(
      'No hay código disponible para esta tarea: planifica a nivel funcional, sin inventar archivos ni rutas, e indícalo en el plan.',
    );
  }
  const branches = used.flatMap((repo) =>
    (repo.branches ?? []).map((branch) => ({ repo, branch })),
  );
  if (branches.length > 0) {
    lines.push(
      '',
      'Ramas de otros tickets que esta tarea menciona. Están clonadas aparte, también de solo lectura, en su propia carpeta:',
      '',
      ...branches.map(
        ({ repo, branch }) =>
          `- \`${branch.folder}/\` — rama \`${branch.branch}\` de \`${repo.name}\` (ticket ${branch.key})`,
      ),
      '',
      'Si la tarea depende de algo de esas ramas (un campo nuevo de la API, un contrato, una clase), ese trabajo YA existe aunque no esté en la rama principal: léelo ahí para verificar nombres, tipos y comportamiento, y no lo des por no hecho ni por no mergeado. Distingue en el plan lo que existe en la rama principal de lo que solo existe en esas ramas.',
    );
  }
  const skipped = repos.filter((repo) => !repo.used);
  if (skipped.length > 0) {
    lines.push(
      '',
      'Repositorios que no se pudieron leer:',
      ...skipped.map(
        (repo) => `- ${repo.url}: ${repo.note ?? 'no disponible'}`,
      ),
    );
  }
  return lines;
}

/**
 * Contexto de una replanificación: el plan anterior (solo ese, aunque haya más en el historial), la
 * conversación con el usuario y qué se espera del agente.
 */
function revisionLines(revision: PlanRevision): string[] {
  const previous = revision.previousPlan?.trim();
  return [
    '',
    '## Plan anterior',
    '',
    previous
      ? previous.length > MAX_PREVIOUS_PLAN_CHARS
        ? `${previous.slice(0, MAX_PREVIOUS_PLAN_CHARS).trimEnd()}\n[…plan recortado…]`
        : previous
      : '(No hay un plan anterior: elabora el plan desde cero teniendo en cuenta la conversación.)',
    '',
    '## Conversación con el usuario sobre el plan',
    '',
    ...conversationLines(
      revision.conversation,
      {
        maxMessages: revision.conversation.length,
        maxChars: MAX_REVISION_CONVERSATION_CHARS,
      },
      revision.staged,
    ),
    ...(patches(revision) ? patchInstructions(revision) : fullInstructions()),
  ];
}

/** Se edita el plan anterior (en vez de rehacerlo) cuando lo hay y no se pidió el plan completo. */
function patches(revision: PlanRevision): boolean {
  return !!revision.previousPlan?.trim() && revision.mode !== 'full';
}

/** Cómo debe quedar el plan tras un cambio, sea por edición o reescribiéndolo. */
function cleanPlanRules(): string[] {
  return [
    '- Integra lo aclarado en el paso o la sección a la que corresponde: el dato, la decisión o el criterio van dentro del paso mismo.',
    '- No dejes rastro de la conversación ni del plan anterior: nada de «el usuario aclaró», «según lo conversado», «actualizado» o «resuelto», ni listas o secciones que respondan dudas.',
    '- Lo que quedó respondido sale de las dudas (bórralo, no lo respondas ahí); lo que el usuario descartó no aparece. Las dudas son solo lo que sigue sin definirse.',
  ];
}

function fullInstructions(): string[] {
  return [
    '## Qué hacer ahora',
    '',
    'Esta es una replanificación. Escribe el plan completo como si lo hubieras hecho desde cero con toda la información: la de la tarea, sus tickets y lo aclarado en la conversación. El plan anterior es la base: conserva lo que no cambia, y lo que cambia queda integrado en su lugar.',
    ...cleanPlanRules(),
    'Entrega el plan completo, con el mismo formato de siempre; no un resumen de los cambios.',
  ];
}

/** Reglas que valen para todo plan, nuevo o replanificado, y que prevalecen sobre el formato del agente si este dice otra cosa. */
function planRules(): string[] {
  return [
    '',
    '## Reglas del plan',
    '',
    '- Sé concreto: cada paso es una acción que se pueda hacer y verificar (qué archivo o módulo tocar y qué cambiar), sin relleno ni generalidades.',
    '- No estimes: no pongas horas, días, tamaños ni esfuerzo, y omite cualquier sección de estimación que tu formato pida.',
    '- Las dudas son solo lo que de verdad falta por definir. Nunca pongas respuestas ni aclaraciones en una sección de dudas.',
    '- Escribe el plan como una especificación final: sin historial ni menciones a versiones anteriores ni a lo conversado.',
  ];
}

function patchInstructions(revision: PlanRevision): string[] {
  return [
    '## Qué hacer ahora',
    '',
    'Esta es una replanificación. Cambia el plan anterior con lo conversado, pero el resultado debe leerse como si el plan se hubiera escrito desde cero con toda esa información: modifica solo lo que haga falta, y cada cambio déjalo como lo habrías escrito desde el principio.',
    '',
    ...cleanPlanRules(),
    '',
    '**NO reescribas el plan entero.** Responde SOLO con bloques de edición, uno por cada fragmento que cambia, con este formato exacto (cada marca en su propia línea):',
    '',
    '```',
    '<<<<<<< BUSCAR',
    '(el texto actual del plan que se cambia, copiado tal cual)',
    '=======',
    '(el texto nuevo)',
    '>>>>>>> REEMPLAZAR',
    '```',
    '',
    '- BUSCAR debe ser una copia exacta de lo que dice el plan anterior (mismas palabras, signos y saltos de línea) y aparecer UNA sola vez: si el fragmento se repite, incluye líneas de alrededor.',
    '- Para añadir algo, busca la línea junto a la que va y repítela en REEMPLAZAR con lo nuevo a continuación. Para borrar algo, deja REEMPLAZAR vacío.',
    '- Si un cambio obliga a tocar otras partes para que el plan siga coherente (pasos que cambian de número o de orden, riesgos, pruebas, dudas), edítalas también.',
    '- Pon cada bloque con lo mínimo necesario, no párrafos enteros si solo cambia una línea. Los bloques se aplican en el orden en que los escribas.',
    '- No escribas nada fuera de los bloques (ni resumen, ni explicaciones, ni el plan). Si la conversación no pide ningún cambio al plan, responde solo `SIN CAMBIOS`.',
    ...(revision.patchError
      ? [
          '',
          '**Tu respuesta anterior no se pudo aplicar** y el plan sigue como estaba:',
          '',
          revision.patchError,
          '',
          'Corrige los bloques y vuelve a entregarlos todos.',
        ]
      : []),
  ];
}

/**
 * Contexto que recibe el agente planificador (el prompt del agente, editable en la UI, define el
 * formato del plan). Es una función pura.
 */
export function buildPlanPrompt({
  task,
  tickets,
  repos,
  revision,
}: PlanPromptInput): string {
  return [
    '# Tarea a planificar',
    '',
    ...taskLines(task),
    ...groupLines(task),
    ...ticketLines(tickets, '## Tickets citados en la tarea'),
    ...repoLines(repos),
    ...(revision ? revisionLines(revision) : []),
    ...planRules(),
  ].join('\n');
}
