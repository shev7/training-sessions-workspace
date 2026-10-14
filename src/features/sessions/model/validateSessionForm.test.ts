import { describe, expect, it } from "vitest";
import {
  STARTS_AT_ERROR,
  TITLE_ERROR,
  validateSessionForm,
} from "./validateSessionForm";

const NOW = new Date("2026-10-14T12:00:00");
const FUTURE_LOCAL = "2026-10-14T12:01";
const VALID_TITLE = "abc";

const validateTitle = (title: string) =>
  validateSessionForm({ title, startsAtLocal: FUTURE_LOCAL, now: NOW });

const validateStartsAt = (startsAtLocal: string) =>
  validateSessionForm({ title: VALID_TITLE, startsAtLocal, now: NOW });

describe("validateSessionForm", () => {
  it.each([
    ["  ab ", false],
    ["   ", false],
    ["abc", true],
    ["a".repeat(80), true],
    ["a".repeat(81), false],
  ])("validates title %j as %s", (title, expectedValid) => {
    const result = validateTitle(title);

    expect(result.isValid).toBe(expectedValid);

    if (!result.isValid) {
      expect(result.errors).toEqual({ title: TITLE_ERROR });
    }
  });

  it.each([
    ["", false],
    ["2026-10-14T12:00", false],
    ["2026-10-14T11:00", false],
    [FUTURE_LOCAL, true],
  ])("validates start %j as %s", (startsAtLocal, expectedValid) => {
    const result = validateStartsAt(startsAtLocal);

    expect(result.isValid).toBe(expectedValid);

    if (!result.isValid) {
      expect(result.errors).toEqual({ startsAt: STARTS_AT_ERROR });
    }
  });

  it("returns both errors when both fields are invalid", () => {
    const result = validateSessionForm({
      title: "",
      startsAtLocal: "",
      now: NOW,
    });

    expect(result).toEqual({
      isValid: false,
      errors: { title: TITLE_ERROR, startsAt: STARTS_AT_ERROR },
    });
  });

  it("returns the trimmed title and an ISO start", () => {
    const result = validateSessionForm({
      title: "  Evening Stretch  ",
      startsAtLocal: FUTURE_LOCAL,
      now: NOW,
    });

    expect(result).toEqual({
      isValid: true,
      value: {
        title: "Evening Stretch",
        startsAt: new Date(FUTURE_LOCAL).toISOString(),
      },
    });
  });
});
