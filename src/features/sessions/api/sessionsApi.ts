import { requestJson } from "../../../shared/api/httpClient";
import {
  isSession,
  isSessionList,
  type CreateSessionInput,
  type Session,
} from "../model/session";

const SESSIONS_PATH = "/api/sessions";

export const fetchSessions = async (
  signal?: AbortSignal,
): Promise<Session[]> => {
  const data = await requestJson(SESSIONS_PATH, { signal });

  if (!isSessionList(data)) {
    throw new Error("Malformed sessions response");
  }

  return data;
};

export const createSession = async (
  input: CreateSessionInput,
): Promise<Session> => {
  const data = await requestJson(SESSIONS_PATH, {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!isSession(data)) {
    throw new Error("Malformed session response");
  }

  return data;
};
