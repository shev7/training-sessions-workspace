export const SESSION_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

export type Session = {
  id: string;
  title: string;
  status: SessionStatus;
  startsAt: string;
};

export type CreateSessionInput = Pick<Session, "title" | "startsAt">;

export type StatusFilterValue = SessionStatus | "all";

export const STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

export const isSessionStatus = (value: unknown): value is SessionStatus =>
  SESSION_STATUSES.some((status) => status === value);

export const isCreateSessionInput = (
  value: unknown,
): value is CreateSessionInput => {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.title === "string" && typeof value.startsAt === "string";
};

export const isSession = (value: unknown): value is Session => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    isSessionStatus(value.status) &&
    isCreateSessionInput(value)
  );
};

export const isSessionList = (value: unknown): value is Session[] =>
  Array.isArray(value) && value.every(isSession);
