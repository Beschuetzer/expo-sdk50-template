import {
  beginWebSessionLogout,
  isWebSessionLogoutPending,
  registerPendingWebRefresh,
  throwIfWebSessionLogoutPending,
} from './webSession';

describe('web session logout coordination', () => {
  it('tracks overlapping logouts and releases each logout only once', () => {
    expect(isWebSessionLogoutPending()).toBe(false);

    const firstLogout = beginWebSessionLogout();
    const secondLogout = beginWebSessionLogout();

    expect(isWebSessionLogoutPending()).toBe(true);
    expect(() => throwIfWebSessionLogoutPending()).toThrow(
      expect.objectContaining({ name: 'AbortError' }),
    );

    firstLogout.release();
    firstLogout.release();
    expect(isWebSessionLogoutPending()).toBe(true);

    secondLogout.release();
    expect(isWebSessionLogoutPending()).toBe(false);
    expect(() => throwIfWebSessionLogoutPending()).not.toThrow();
  });

  it('cancels pending refreshes and refreshes registered during logout', () => {
    let resolvePending!: () => void;
    let resolveLate!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolvePending = resolve;
    });
    const latePending = new Promise<void>((resolve) => {
      resolveLate = resolve;
    });
    const cancelPending = jest.fn();
    const cancelLate = jest.fn();
    const unregisterPending = registerPendingWebRefresh(
      pending,
      cancelPending,
    );

    const logout = beginWebSessionLogout();
    expect(cancelPending).toHaveBeenCalledTimes(1);

    const unregisterLate = registerPendingWebRefresh(latePending, cancelLate);
    expect(cancelLate).toHaveBeenCalledTimes(1);

    unregisterPending();
    unregisterLate();
    resolvePending();
    resolveLate();
    logout.release();
  });

  it('unregisters refreshes when their promises resolve or reject', async () => {
    const cancel = jest.fn();
    registerPendingWebRefresh(Promise.resolve(), cancel);
    registerPendingWebRefresh(
      Promise.reject(new Error('refresh failed')),
      cancel,
    );

    await Promise.resolve();
    await Promise.resolve();

    const logout = beginWebSessionLogout();
    expect(cancel).not.toHaveBeenCalled();
    logout.release();
  });

  it('waits for pending refreshes, including ones registered while draining', async () => {
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<void>((resolve) => {
      resolveSecond = resolve;
    });

    registerPendingWebRefresh(first);
    first.then(() => registerPendingWebRefresh(second));

    const logout = beginWebSessionLogout();
    const waiting = logout.waitForPendingRefreshes();
    resolveFirst();
    await first;
    resolveSecond();

    await expect(waiting).resolves.toBeUndefined();
    logout.release();
  });

  it('returns immediately when no refreshes are pending', () => {
    const logout = beginWebSessionLogout();

    expect(logout.waitForPendingRefreshes()).toBeUndefined();

    logout.release();
  });

  it('rejects a pending-refresh wait when its signal is aborted', async () => {
    let resolvePending!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolvePending = resolve;
    });
    registerPendingWebRefresh(pending);

    const logout = beginWebSessionLogout();
    const controller = new AbortController();
    const waiting = logout.waitForPendingRefreshes(controller.signal);
    controller.abort();

    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    resolvePending();
    await pending;
    logout.release();
  });
});
