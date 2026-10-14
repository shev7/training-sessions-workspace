import { useCreateSessionForm } from "../hooks/useCreateSessionForm";
import type { Session } from "../model/session";

type CreateSessionFormProps = {
  onCreated: (session: Session) => void;
  onCancel: () => void;
};

const TITLE_INPUT_ID = "session-title";
const TITLE_ERROR_ID = "session-title-error";
const STARTS_AT_INPUT_ID = "session-starts-at";
const STARTS_AT_ERROR_ID = "session-starts-at-error";

export const CreateSessionForm = ({
  onCreated,
  onCancel,
}: CreateSessionFormProps) => {
  const {
    title,
    startsAtLocal,
    fieldErrors,
    submitState,
    handleTitleChange,
    handleStartsAtChange,
    handleSubmit,
  } = useCreateSessionForm({ onCreated });
  const isPending = submitState.status === "pending";

  return (
    <form
      aria-label="Create session"
      className="create-form"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="field">
        <label htmlFor={TITLE_INPUT_ID}>Title</label>
        <input
          id={TITLE_INPUT_ID}
          name="title"
          type="text"
          autoComplete="off"
          value={title}
          onChange={handleTitleChange}
          aria-invalid={fieldErrors.title ? true : undefined}
          aria-describedby={fieldErrors.title ? TITLE_ERROR_ID : undefined}
        />
        {fieldErrors.title ? (
          <p id={TITLE_ERROR_ID} className="field-error">
            {fieldErrors.title}
          </p>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor={STARTS_AT_INPUT_ID}>Start date and time</label>
        <input
          id={STARTS_AT_INPUT_ID}
          name="startsAt"
          type="datetime-local"
          value={startsAtLocal}
          onChange={handleStartsAtChange}
          aria-invalid={fieldErrors.startsAt ? true : undefined}
          aria-describedby={
            fieldErrors.startsAt ? STARTS_AT_ERROR_ID : undefined
          }
        />
        {fieldErrors.startsAt ? (
          <p id={STARTS_AT_ERROR_ID} className="field-error">
            {fieldErrors.startsAt}
          </p>
        ) : null}
      </div>
      {submitState.status === "error" ? (
        <p role="alert">Could not create the session. Please try again.</p>
      ) : null}
      <button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create session"}
      </button>
      <button type="button" disabled={isPending} onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
};
