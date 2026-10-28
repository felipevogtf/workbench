import { AutoReplySettings } from './auto-reply-settings';

describe('AutoReplySettings', () => {
  it('starts off, in draft mode and looking every minute', () => {
    const settings = AutoReplySettings.defaults();

    expect(settings).toMatchObject({
      enabled: false,
      intervalSeconds: 60,
      mode: 'draft',
    });
    expect(settings.contacts).toEqual([]);
  });

  it('accepts a faster interval within the limits', () => {
    const settings = AutoReplySettings.defaults();

    settings.update({ intervalSeconds: 15 });

    expect(settings.intervalSeconds).toBe(15);
  });

  it.each([5, 9, 3601, 30.5])('rejects the interval %s', (seconds) => {
    const settings = AutoReplySettings.defaults();

    expect(() => settings.update({ intervalSeconds: seconds })).toThrow(
      'between 10 and 3600',
    );
    expect(settings.intervalSeconds).toBe(60);
  });

  it('keeps what was last seen of a contact that stays, and starts new ones empty', () => {
    const settings = AutoReplySettings.defaults();
    settings.update({ contacts: [{ userId: 'U1', name: 'Oscar' }] });
    settings.markSeen('U1', '100.000100');

    settings.update({
      contacts: [
        { userId: 'U1', name: 'Oscar Medina' },
        { userId: 'U2', name: 'Juan' },
      ],
    });

    expect(settings.contacts).toEqual([
      { userId: 'U1', name: 'Oscar Medina', lastSeenTs: '100.000100' },
      { userId: 'U2', name: 'Juan', lastSeenTs: null },
    ]);
  });

  it('rejects a contact twice and too many contacts', () => {
    const settings = AutoReplySettings.defaults();

    expect(() =>
      settings.update({
        contacts: [
          { userId: 'U1', name: 'a' },
          { userId: 'U1', name: 'b' },
        ],
      }),
    ).toThrow('twice');
    expect(() =>
      settings.update({
        contacts: Array.from({ length: 11 }, (_, i) => ({
          userId: `U${i}`,
          name: 'x',
        })),
      }),
    ).toThrow('At most 10');
  });

  it('turns on and off', () => {
    const settings = AutoReplySettings.defaults();

    settings.update({ enabled: true });
    expect(settings.enabled).toBe(true);
    settings.update({ enabled: false });
    expect(settings.enabled).toBe(false);
  });
});
