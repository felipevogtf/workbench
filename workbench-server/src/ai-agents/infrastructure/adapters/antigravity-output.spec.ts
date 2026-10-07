import {
  AntigravityDeniedError,
  extractAntigravityAnswer,
} from './antigravity-output';

describe('extractAntigravityAnswer', () => {
  it('returns the response of a successful run', () => {
    const out = JSON.stringify({
      status: 'SUCCESS',
      response: '## Resumen\nOk\n',
    });
    expect(extractAntigravityAnswer(out)).toBe('## Resumen\nOk');
  });

  it('explains which action was denied when the response is empty', () => {
    const out = JSON.stringify({
      status: 'SUCCESS',
      response: '',
      denied_actions: [{ action: 'command', display_name: 'RunCommand' }],
    });
    expect(() => extractAntigravityAnswer(out)).toThrow(/denied RunCommand/);
    expect(() => extractAntigravityAnswer(out)).toThrow(AntigravityDeniedError);
  });

  it('fails on an error status', () => {
    const out = JSON.stringify({ status: 'ERROR', error: 'quota exceeded' });
    expect(() => extractAntigravityAnswer(out)).toThrow(
      /ERROR: quota exceeded/,
    );
  });

  it('uses plain text when the output is not JSON', () => {
    expect(extractAntigravityAnswer(' texto \n')).toBe('texto');
  });
});
