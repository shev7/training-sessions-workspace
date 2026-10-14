import { delay, http, HttpResponse } from "msw";
import { isCreateSessionInput } from "../features/sessions/model/session";
import { insertSession, listSessions } from "./sessionsStore";

export const MOCK_DELAY_MS = 500;

type HandlerOptions = { delayMs: number };

export const createSessionHandlers = ({ delayMs }: HandlerOptions) => [
  http.get("/api/sessions", async () => {
    await delay(delayMs);

    return HttpResponse.json(listSessions());
  }),
  http.post("/api/sessions", async ({ request }) => {
    await delay(delayMs);
    const body: unknown = await request.json();

    if (!isCreateSessionInput(body)) {
      return HttpResponse.json(
        { message: "Invalid session" },
        { status: 400 },
      );
    }

    return HttpResponse.json(insertSession(body), { status: 201 });
  }),
];
