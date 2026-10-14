import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "../mocks/server";
import { resetSessionsStore } from "../mocks/sessionsStore";
import { installNodeSignalFetch } from "./nodeSignalFetch";

let uninstallNodeSignalFetch = (): void => undefined;

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  uninstallNodeSignalFetch = installNodeSignalFetch();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  server.events.removeAllListeners();
  resetSessionsStore();
});

afterAll(() => {
  uninstallNodeSignalFetch();
  server.close();
});
