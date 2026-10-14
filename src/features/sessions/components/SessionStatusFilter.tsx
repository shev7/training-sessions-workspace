import type { ChangeEvent } from "react";
import {
  isSessionStatus,
  SESSION_STATUSES,
  STATUS_LABELS,
  type StatusFilterValue,
} from "../model/session";

type SessionStatusFilterProps = {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
};

const FILTER_SELECT_ID = "session-status-filter";

const toFilterValue = (value: string): StatusFilterValue =>
  isSessionStatus(value) ? value : "all";

export const SessionStatusFilter = ({
  value,
  onChange,
}: SessionStatusFilterProps) => {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    onChange(toFilterValue(event.target.value));
  };

  return (
    <div className="field">
      <label htmlFor={FILTER_SELECT_ID}>Status</label>
      <select id={FILTER_SELECT_ID} value={value} onChange={handleChange}>
        <option value="all">All</option>
        {SESSION_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </div>
  );
};
