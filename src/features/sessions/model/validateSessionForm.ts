import type { CreateSessionInput } from "./session";
import { toStartsAtIso } from "./toStartsAtIso";

export const TITLE_ERROR = "Title must be 3–80 characters";
export const STARTS_AT_ERROR = "Choose a date and time in the future";

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 80;

export type SessionFormField = "title" | "startsAt";

export type SessionFormErrors = Partial<Record<SessionFormField, string>>;

export type SessionFormValues = {
  title: string;
  startsAtLocal: string;
  now: Date;
};

export type SessionFormValidation =
  | { isValid: true; value: CreateSessionInput }
  | { isValid: false; errors: SessionFormErrors };

const isTitleValid = (trimmedTitle: string): boolean =>
  trimmedTitle.length >= TITLE_MIN_LENGTH &&
  trimmedTitle.length <= TITLE_MAX_LENGTH;

const isStartsAtInFuture = (startsAtLocal: string, now: Date): boolean => {
  if (startsAtLocal === "") {
    return false;
  }

  const startsAt = new Date(startsAtLocal).getTime();

  return !Number.isNaN(startsAt) && startsAt > now.getTime();
};

const collectErrors = ({
  title,
  startsAtLocal,
  now,
}: SessionFormValues): SessionFormErrors => ({
  ...(isTitleValid(title.trim()) ? {} : { title: TITLE_ERROR }),
  ...(isStartsAtInFuture(startsAtLocal, now)
    ? {}
    : { startsAt: STARTS_AT_ERROR }),
});

export const validateSessionForm = (
  values: SessionFormValues,
): SessionFormValidation => {
  const errors = collectErrors(values);

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: {
      title: values.title.trim(),
      startsAt: toStartsAtIso(values.startsAtLocal),
    },
  };
};
