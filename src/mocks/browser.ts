import { setupWorker } from "msw/browser";
import { createSessionHandlers, MOCK_DELAY_MS } from "./handlers";

export const worker = setupWorker(
  ...createSessionHandlers({ delayMs: MOCK_DELAY_MS }),
);
