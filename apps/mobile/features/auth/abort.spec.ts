import { awaitWithAbort, throwIfAborted } from './abort';

describe('abort helpers', () => {
  it('passes promises through when no signal is provided', async () => {
    const promise = Promise.resolve('complete');

    expect(awaitWithAbort(promise)).toBe(promise);
    await expect(awaitWithAbort(promise)).resolves.toBe('complete');
    expect(() => throwIfAborted()).not.toThrow();
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    expect(() => throwIfAborted(controller.signal)).toThrow(
      'The operation was aborted.',
    );
    await expect(
      awaitWithAbort(Promise.resolve('complete'), controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});