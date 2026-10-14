import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createSession } from "../api/sessionsApi";
import type { CreateSessionInput, Session } from "../model/session";
import {
  validateSessionForm,
  type SessionFormErrors,
} from "../model/validateSessionForm";

type UseCreateSessionFormOptions = {
  onCreated: (session: Session) => void;
};

export type SubmitState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "error" };

type InputChangeEvent = ChangeEvent<HTMLInputElement>;

type UseCreateSessionFormResult = {
  title: string;
  startsAtLocal: string;
  fieldErrors: SessionFormErrors;
  submitState: SubmitState;
  handleTitleChange: (event: InputChangeEvent) => void;
  handleStartsAtChange: (event: InputChangeEvent) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export const useCreateSessionForm = ({
  onCreated,
}: UseCreateSessionFormOptions): UseCreateSessionFormResult => {
  const [title, setTitle] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SessionFormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
  });
  const isSubmittingRef = useRef(false);

  const handleTitleChange = (event: InputChangeEvent): void => {
    setTitle(event.target.value);
  };

  const handleStartsAtChange = (event: InputChangeEvent): void => {
    setStartsAtLocal(event.target.value);
  };

  const resetForm = (): void => {
    setTitle("");
    setStartsAtLocal("");
    setFieldErrors({});
    setSubmitState({ status: "idle" });
  };

  const submitSession = async (input: CreateSessionInput): Promise<void> => {
    isSubmittingRef.current = true;
    setSubmitState({ status: "pending" });

    try {
      const session = await createSession(input);
      resetForm();
      onCreated(session);
    } catch {
      setSubmitState({ status: "error" });
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    if (isSubmittingRef.current) {
      return;
    }

    const result = validateSessionForm({
      title,
      startsAtLocal,
      now: new Date(),
    });

    if (!result.isValid) {
      setFieldErrors(result.errors);

      return;
    }

    setFieldErrors({});
    await submitSession(result.value);
  };

  return {
    title,
    startsAtLocal,
    fieldErrors,
    submitState,
    handleTitleChange,
    handleStartsAtChange,
    handleSubmit,
  };
};
