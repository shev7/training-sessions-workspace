import type { SessionsState } from "../hooks/useSessions";
import type { Session } from "../model/session";
import { SessionList } from "./SessionList";

type SessionsPanelProps = {
  state: SessionsState;
  visibleSessions: Session[];
  onRetry: () => void;
};

export const SessionsPanel = ({
  state,
  visibleSessions,
  onRetry,
}: SessionsPanelProps) => {
  if (state.status === "loading") {
    return <p role="status">Loading sessions…</p>;
  }

  if (state.status === "error") {
    return (
      <div role="alert">
        <p>Could not load sessions.</p>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (state.sessions.length === 0) {
    return <p>No sessions yet.</p>;
  }

  if (visibleSessions.length === 0) {
    return <p>No sessions match this status.</p>;
  }

  return <SessionList sessions={visibleSessions} />;
};
