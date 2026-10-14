import type {
  CreateSessionInput,
  Session,
} from "../features/sessions/model/session";
import { SESSIONS_SEED } from "./sessionsSeed";

const FIRST_CREATED_ID = SESSIONS_SEED.length + 1;

let sessions: Session[] = [...SESSIONS_SEED];
let nextId = FIRST_CREATED_ID;

export const listSessions = (): Session[] => [...sessions];

export const insertSession = (input: CreateSessionInput): Session => {
  const session: Session = {
    id: `session-${nextId}`,
    status: "scheduled",
    title: input.title,
    startsAt: input.startsAt,
  };

  sessions = [...sessions, session];
  nextId += 1;

  return session;
};

export const resetSessionsStore = (): void => {
  sessions = [...SESSIONS_SEED];
  nextId = FIRST_CREATED_ID;
};
