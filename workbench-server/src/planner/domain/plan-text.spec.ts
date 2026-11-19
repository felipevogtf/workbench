import { cleanPlan } from './plan-text';

describe('cleanPlan', () => {
  it('drops what the model says before the plan starts', () => {
    const plan = cleanPlan(
      'Ya tengo suficiente contexto del código y voy a escribir el plan.\n\n# Plan: guías anuladas\n\n## Objetivo\n\nAlgo.',
    );

    expect(plan).toBe('# Plan: guías anuladas\n\n## Objetivo\n\nAlgo.');
  });

  it('drops several lines of chatter, and starts at a second-level heading too', () => {
    expect(cleanPlan('Listo.\nAquí va:\n\n## Objetivo\nHacer algo')).toBe(
      '## Objetivo\nHacer algo',
    );
  });

  it('leaves a plan that already starts with its heading as it is', () => {
    const plan = '# Plan\n\n## Objetivo\n\nHacer algo\n\n## Riesgos\n\nNinguno';

    expect(cleanPlan(plan)).toBe(plan);
  });

  it('takes the plan out of a code block that wraps all of it', () => {
    expect(cleanPlan('```markdown\n# Plan\n\n## Objetivo\nX\n```')).toBe(
      '# Plan\n\n## Objetivo\nX',
    );
    expect(cleanPlan('```\n## Objetivo\nX\n```')).toBe('## Objetivo\nX');
  });

  it('removes the chatter and the wrapping block together', () => {
    expect(cleanPlan('Aquí está:\n```md\n# Plan\ntexto\n```')).toBe(
      '# Plan\ntexto',
    );
  });

  it('keeps code blocks that belong to the plan, and headings inside them', () => {
    const plan =
      '## Objetivo\n\n```sh\n# comentario\nnpm test\n```\n\n## Riesgos';

    expect(cleanPlan(plan)).toBe(plan);
  });

  it('does not touch a text without any heading', () => {
    expect(cleanPlan('  Solo texto, sin encabezados.  ')).toBe(
      'Solo texto, sin encabezados.',
    );
  });

  it('gives an empty text back empty', () => {
    expect(cleanPlan('   \n ')).toBe('');
  });
});
