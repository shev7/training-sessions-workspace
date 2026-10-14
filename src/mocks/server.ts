import { setupServer } from "msw/node";
import { createSessionHandlers } from "./handlers";

export const server = setupServer(...createSessionHandlers({ delayMs: 0 }));
