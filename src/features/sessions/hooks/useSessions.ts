import { useEffect, useState } from "react";
import { fetchSessions } from "../api/sessionsApi";
import type { Session } from "../model/session";

export type SessionsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; sessions: Session[] };

type UseSessionsResult = {
  state: SessionsState;
  retry: () => void;
  addSession: (session: Session) => void;
};

export const useSessions = (): UseSessionsResult => {
  const [state, setState] = useState<SessionsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const loadSessions = async (): Promise<void> => {
      try {
        const sessions = await fetchSessions(controller.signal);
        setState({ status: "success", sessions });
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setState({ status: "error" });
      }
    };

    loadSessions();

    return () => controller.abort();
  }, [attempt]);

  const retry = (): void => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  };

  const addSession = (session: Session): void => {
    setState((previous) => {
      if (previous.status !== "success") {
        return previous;
      }

      return { ...previous, sessions: [...previous.sessions, session] };
    });
  };

  return { state, retry, addSession };
};
