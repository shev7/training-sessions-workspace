import type { Session } from "../features/sessions/model/session";

export const SESSIONS_SEED: readonly Session[] = [
  {
    id: "session-1",
    title: "Morning Yoga",
    status: "scheduled",
    startsAt: "2026-11-02T07:30:00.000Z",
  },
  {
    id: "session-2",
    title: "Strength Basics",
    status: "completed",
    startsAt: "2026-09-15T16:00:00.000Z",
  },
  {
    id: "session-3",
    title: "HIIT Express",
    status: "cancelled",
    startsAt: "2026-10-01T12:00:00.000Z",
  },
  {
    id: "session-4",
    title: "Mobility Flow",
    status: "scheduled",
    startsAt: "2026-11-10T18:00:00.000Z",
  },
];
