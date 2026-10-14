import { formatStartsAt } from "../model/formatStartsAt";
import { STATUS_LABELS, type Session } from "../model/session";

type SessionListProps = {
  sessions: Session[];
};

export const SessionList = ({ sessions }: SessionListProps) => (
  <ul aria-label="Sessions" className="session-list">
    {sessions.map((session) => (
      <li key={session.id} className="session-item">
        <span className="session-title">{session.title}</span>
        <span className="session-status">{STATUS_LABELS[session.status]}</span>
        <time dateTime={session.startsAt}>
          {formatStartsAt(session.startsAt)}
        </time>
      </li>
    ))}
  </ul>
);
