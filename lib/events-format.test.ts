import { describe, it, expect } from "vitest";
import { formatEventDates, eventTiming } from "@/lib/events";

const d = (s: string) => new Date(s);

describe("event date formatting", () => {
  it("shows a single day as one date, not a range", () => {
    expect(formatEventDates(d("2026-08-08T14:00:00-04:00"), d("2026-08-08T22:00:00-04:00")))
      .toBe("August 8, 2026");
  });

  // "8 August 2026 – 12 August 2026" is noise on a card; the shared month and
  // year collapse.
  it("collapses a run within one month", () => {
    expect(formatEventDates(d("2026-08-08T12:00:00-04:00"), d("2026-08-12T12:00:00-04:00")))
      .toBe("8–12 August 2026");
  });

  it("spells both dates out when the run crosses a month", () => {
    const s = formatEventDates(d("2026-08-28T12:00:00-04:00"), d("2026-09-03T12:00:00-04:00"));
    expect(s).toContain("August 28, 2026");
    expect(s).toContain("September 3, 2026");
  });
});

describe("event timing", () => {
  const now = d("2026-08-25T12:00:00-04:00");

  it("says On now while an event is running", () => {
    expect(eventTiming(d("2026-08-20T12:00:00-04:00"), d("2026-08-30T12:00:00-04:00"), now))
      .toBe("On now");
  });

  it("counts down the near future in plain words", () => {
    expect(eventTiming(d("2026-08-26T12:00:00-04:00"), d("2026-08-26T18:00:00-04:00"), now))
      .toBe("Tomorrow");
    expect(eventTiming(d("2026-08-28T12:00:00-04:00"), d("2026-08-28T18:00:00-04:00"), now))
      .toBe("In 3 days");
  });

  // Anything far off gets no badge — "In 94 days" is not useful urgency.
  it("says nothing about the distant future", () => {
    expect(eventTiming(d("2026-11-27T12:00:00-04:00"), d("2026-11-28T12:00:00-04:00"), now))
      .toBe("");
  });
});
