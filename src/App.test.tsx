import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { formatStartsAt } from "./features/sessions/model/formatStartsAt";
import {
  isCreateSessionInput,
  type Session,
} from "./features/sessions/model/session";
import { server } from "./mocks/server";
import { SESSIONS_SEED } from "./mocks/sessionsSeed";
import { insertSession } from "./mocks/sessionsStore";

const SESSIONS_URL = "/api/sessions";
const FUTURE_LOCAL = "2099-01-01T10:00";
const PAST_LOCAL = "2000-01-01T10:00";
const TITLE_ERROR = "Title must be 3–80 characters";
const STARTS_AT_ERROR = "Choose a date and time in the future";
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type RecordedRequest = { method: string; body: unknown };

type Deferred = { promise: Promise<void>; resolve: () => void };

const createDeferred = (): Deferred => {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

const recordRequests = (): RecordedRequest[] => {
  const requests: RecordedRequest[] = [];

  server.events.on("request:start", async ({ request }) => {
    const body: unknown =
      request.method === "POST" ? await request.clone().json() : undefined;
    requests.push({ method: request.method, body });
  });

  return requests;
};

const countPosts = (requests: RecordedRequest[]): number =>
  requests.filter((request) => request.method === "POST").length;

const getSessionList = () => screen.getByRole("list", { name: "Sessions" });

const findSessionItems = async () => {
  const list = await screen.findByRole("list", { name: "Sessions" });

  return within(list).getAllByRole("listitem");
};

const getStatusFilter = () => screen.getByRole("combobox", { name: "Status" });

const getTitleInput = () => screen.getByRole("textbox", { name: "Title" });

const getStartsAtInput = () => screen.getByLabelText("Start date and time");

const renderApp = (): UserEvent => {
  const user = userEvent.setup();
  render(<App />);

  return user;
};

type FillFormValues = { user: UserEvent; title: string; startsAt: string };

const fillForm = async ({ user, title, startsAt }: FillFormValues) => {
  await user.clear(getTitleInput());

  if (title !== "") {
    await user.type(getTitleInput(), title);
  }

  await user.clear(getStartsAtInput());

  if (startsAt !== "") {
    await user.type(getStartsAtInput(), startsAt);
  }
};

const submitForm = (user: UserEvent) =>
  user.click(screen.getByRole("button", { name: "Create session" }));

const expectSessionShown = (session: Session): void => {
  const item = within(getSessionList())
    .getByText(session.title)
    .closest("li");

  if (!item) {
    throw new Error(`No list item for ${session.title}`);
  }

  expect(item).toHaveTextContent(formatStartsAt(session.startsAt));
};

describe("Training sessions workspace", () => {
  it("loads sessions and filters them by status", async () => {
    const user = renderApp();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading sessions…",
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(await findSessionItems()).toHaveLength(SESSIONS_SEED.length);
    SESSIONS_SEED.forEach(expectSessionShown);
    expect(getStatusFilter()).toHaveValue("all");

    await user.selectOptions(getStatusFilter(), "Completed");

    const completedItems = within(getSessionList()).getAllByRole("listitem");
    expect(completedItems).toHaveLength(1);
    expect(completedItems[0]).toHaveTextContent("Strength Basics");
    expect(completedItems[0]).toHaveTextContent("Completed");

    await user.selectOptions(getStatusFilter(), "All");

    expect(await findSessionItems()).toHaveLength(SESSIONS_SEED.length);
  });

  it("creates a session once and shows it with the filter reset", async () => {
    const gate = createDeferred();
    server.use(
      http.post(SESSIONS_URL, async ({ request }) => {
        const body: unknown = await request.json();
        await gate.promise;

        if (!isCreateSessionInput(body)) {
          return HttpResponse.json({}, { status: 400 });
        }

        return HttpResponse.json(insertSession(body), { status: 201 });
      }),
    );
    const requests = recordRequests();
    const user = renderApp();
    await findSessionItems();
    await user.selectOptions(getStatusFilter(), "Cancelled");

    await user.click(screen.getByRole("button", { name: "New session" }));

    expect(
      screen.getByRole("form", { name: "Create session" }),
    ).toBeInTheDocument();
    await fillForm({
      user,
      title: "  Evening Stretch  ",
      startsAt: FUTURE_LOCAL,
    });
    await submitForm(user);

    const pendingButton = screen.getByRole("button", { name: "Creating…" });
    expect(pendingButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await user.click(pendingButton);
    await user.type(getTitleInput(), "{Enter}");

    expect(countPosts(requests)).toBe(1);
    expect(requests.find(({ method }) => method === "POST")?.body).toEqual({
      title: "Evening Stretch",
      startsAt: expect.stringMatching(ISO_PATTERN),
    });

    gate.resolve();

    await waitFor(() =>
      expect(
        screen.queryByRole("form", { name: "Create session" }),
      ).not.toBeInTheDocument(),
    );
    expect(getStatusFilter()).toHaveValue("all");
    const items = within(getSessionList()).getAllByRole("listitem");
    expect(items).toHaveLength(SESSIONS_SEED.length + 1);
    const created = within(getSessionList())
      .getByText("Evening Stretch")
      .closest("li");
    expect(created).toHaveTextContent("Scheduled");
    expect(created).toHaveTextContent(
      formatStartsAt(new Date(FUTURE_LOCAL).toISOString()),
    );
    expect(countPosts(requests)).toBe(1);
  });

  it("cancels the create form without sending a request", async () => {
    const requests = recordRequests();
    const user = renderApp();
    await findSessionItems();
    await user.click(screen.getByRole("button", { name: "New session" }));
    await fillForm({ user, title: "Evening Stretch", startsAt: FUTURE_LOCAL });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByRole("form", { name: "Create session" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New session" }),
    ).toBeInTheDocument();
    expect(within(getSessionList()).getAllByRole("listitem")).toHaveLength(
      SESSIONS_SEED.length,
    );
    expect(countPosts(requests)).toBe(0);

    await user.click(screen.getByRole("button", { name: "New session" }));

    expect(getTitleInput()).toHaveValue("");
    expect(getStartsAtInput()).toHaveValue("");
  });

  it("blocks invalid input without sending a request", async () => {
    const requests = recordRequests();
    const user = renderApp();
    await findSessionItems();
    await user.click(screen.getByRole("button", { name: "New session" }));

    await submitForm(user);

    expect(getTitleInput()).toHaveAccessibleDescription(TITLE_ERROR);
    expect(getStartsAtInput()).toHaveAccessibleDescription(STARTS_AT_ERROR);

    await fillForm({ user, title: "ab", startsAt: PAST_LOCAL });
    await submitForm(user);

    expect(getTitleInput()).toHaveAccessibleDescription(TITLE_ERROR);
    expect(getStartsAtInput()).toHaveAccessibleDescription(STARTS_AT_ERROR);

    await fillForm({ user, title: "a".repeat(81), startsAt: FUTURE_LOCAL });
    await submitForm(user);

    expect(getTitleInput()).toHaveAccessibleDescription(TITLE_ERROR);
    expect(getStartsAtInput()).not.toHaveAccessibleDescription();
    expect(countPosts(requests)).toBe(0);
  });

  it("shows a list error and recovers on retry", async () => {
    server.use(
      http.get(
        SESSIONS_URL,
        () => HttpResponse.json({ message: "Boom" }, { status: 500 }),
        { once: true },
      ),
    );
    const user = renderApp();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load sessions.",
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await findSessionItems()).toHaveLength(SESSIONS_SEED.length);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a message when there are no sessions", async () => {
    server.use(http.get(SESSIONS_URL, () => HttpResponse.json([])));
    renderApp();

    expect(await screen.findByText("No sessions yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows a message when no session matches the status", async () => {
    const scheduledOnly = SESSIONS_SEED.filter(
      (session) => session.status === "scheduled",
    );
    server.use(
      http.get(SESSIONS_URL, () => HttpResponse.json(scheduledOnly)),
    );
    const user = renderApp();
    await findSessionItems();

    await user.selectOptions(getStatusFilter(), "Completed");

    expect(
      screen.getByText("No sessions match this status."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("keeps values after a create failure and allows retry", async () => {
    server.use(
      http.post(
        SESSIONS_URL,
        () => HttpResponse.json({ message: "Boom" }, { status: 500 }),
        { once: true },
      ),
    );
    const user = renderApp();
    await findSessionItems();
    await user.click(screen.getByRole("button", { name: "New session" }));
    await fillForm({ user, title: "Evening Stretch", startsAt: FUTURE_LOCAL });

    await submitForm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not create the session. Please try again.",
    );
    expect(getTitleInput()).toHaveValue("Evening Stretch");
    expect(getStartsAtInput()).toHaveValue(FUTURE_LOCAL);

    await submitForm(user);

    expect(
      await within(getSessionList()).findByText("Evening Stretch"),
    ).toBeInTheDocument();
  });
});
