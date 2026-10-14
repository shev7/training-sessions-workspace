import { useState } from "react";
import { useSessions, type SessionsState } from "../hooks/useSessions";
import type { Session, StatusFilterValue } from "../model/session";
import { CreateSessionForm } from "./CreateSessionForm";
import { SessionsPanel } from "./SessionsPanel";
import { SessionStatusFilter } from "./SessionStatusFilter";

type VisibleSessionsOptions = {
  state: SessionsState;
  statusFilter: StatusFilterValue;
};

const getVisibleSessions = ({
  state,
  statusFilter,
}: VisibleSessionsOptions): Session[] => {
  if (state.status !== "success") {
    return [];
  }

  if (statusFilter === "all") {
    return state.sessions;
  }

  return state.sessions.filter((session) => session.status === statusFilter);
};

export const SessionsWorkspace = () => {
  const { state, retry, addSession } = useSessions();
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const visibleSessions = getVisibleSessions({ state, statusFilter });

  const handleSessionCreated = (session: Session): void => {
    addSession(session);
    setStatusFilter("all");
    setIsFormOpen(false);
  };

  const handleOpenForm = (): void => {
    setIsFormOpen(true);
  };

  const handleCloseForm = (): void => {
    setIsFormOpen(false);
  };

  return (
    <section className="workspace">
      <div className="toolbar">
        {state.status === "success" ? (
          <SessionStatusFilter
            value={statusFilter}
            onChange={setStatusFilter}
          />
        ) : null}
        {isFormOpen ? null : (
          <button type="button" onClick={handleOpenForm}>
            New session
          </button>
        )}
      </div>
      {isFormOpen ? (
        <CreateSessionForm
          onCreated={handleSessionCreated}
          onCancel={handleCloseForm}
        />
      ) : null}
      <SessionsPanel
        state={state}
        visibleSessions={visibleSessions}
        onRetry={retry}
      />
    </section>
  );
};
