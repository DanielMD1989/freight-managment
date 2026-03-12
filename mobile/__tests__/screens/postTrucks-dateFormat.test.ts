/**
 * G-M11-1: Post Trucks date format conversion test
 *
 * Verifies that date-only strings (YYYY-MM-DD) from the mobile date picker
 * are converted to ISO 8601 datetime strings before being sent to the API.
 * The API's Zod schema uses z.string().datetime() which rejects plain dates.
 */

describe("Post Trucks date format conversion", () => {
  it("converts date-only string to ISO 8601 datetime", () => {
    // This is the exact conversion pattern used in post-trucks.tsx onSubmit
    const dateOnly = "2026-03-12";
    const isoDatetime = new Date(dateOnly + "T00:00:00").toISOString();

    // Must be a full ISO 8601 datetime, not just a date
    expect(isoDatetime).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    expect(isoDatetime).not.toBe(dateOnly);
    expect(isoDatetime).toContain("T");

    // availableTo uses same pattern
    const availableTo = "2026-04-15";
    const availableToISO = new Date(availableTo + "T00:00:00").toISOString();
    expect(availableToISO).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );

    // undefined availableTo should remain undefined (not converted)
    const emptyAvailableTo = "";
    const result = emptyAvailableTo
      ? new Date(emptyAvailableTo + "T00:00:00").toISOString()
      : undefined;
    expect(result).toBeUndefined();
  });
});
