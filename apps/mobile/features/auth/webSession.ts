import { awaitWithAbort } from './abort';

type PendingWebRefresh = {
  cancel?: () => void;
  promise: Promise<unknown>;
};

const pendingWebRefreshes = new Set<PendingWebRefresh>();
let activeWebLogouts = 0;

export function registerPendingWebRefresh(
  promise: Promise<unknown>,
  cancel?: () => void,
) {
  const pending = { cancel, promise };
  pendingWebRefreshes.add(pending);
  const unregister = () => pendingWebRefreshes.delete(pending);
  promise.then(unregister, unregister);
  if (activeWebLogouts > 0) cancel?.();
  return unregister;
}

export function isWebSessionLogoutPending() {
  return activeWebLogouts > 0;
}

export function beginWebSessionLogout() {
  activeWebLogouts += 1;
  for (const pending of pendingWebRefreshes) {
    pending.cancel?.();
  }

  let released = false;
  return {
    waitForPendingRefreshes(signal?: AbortSignal) {
      if (pendingWebRefreshes.size === 0) return;

      return (async () => {
        while (pendingWebRefreshes.size > 0) {
          const requests = Array.from(
            pendingWebRefreshes,
            ({ promise }) => promise,
          );
          await awaitWithAbort(Promise.allSettled(requests), signal);
        }
      })();
    },
    release() {
      if (released) return;
      released = true;
      activeWebLogouts -= 1;
    },
  };
}

export function throwIfWebSessionLogoutPending() {
  if (!isWebSessionLogoutPending()) return;

  const error = new Error('The web session is being logged out.');
  error.name = 'AbortError';
  throw error;
}
