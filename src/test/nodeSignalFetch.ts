import { transferableAbortController } from "node:util";

// jsdom replaces the global AbortController, but Node's fetch (used by the
// MSW interceptor) only accepts signals created by Node itself. Mirror the
// jsdom signal into a Node signal so request cancellation keeps working.
const toNodeSignal = (signal: AbortSignal): AbortSignal => {
  const controller = transferableAbortController();

  if (signal.aborted) {
    controller.abort(signal.reason);

    return controller.signal;
  }

  signal.addEventListener("abort", () => controller.abort(signal.reason), {
    once: true,
  });

  return controller.signal;
};

const withNodeSignal = (init?: RequestInit): RequestInit | undefined => {
  if (!init?.signal) {
    return init;
  }

  return { ...init, signal: toNodeSignal(init.signal) };
};

export const installNodeSignalFetch = (): (() => void) => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (input, init) =>
    originalFetch(input, withNodeSignal(init));

  return () => {
    globalThis.fetch = originalFetch;
  };
};
