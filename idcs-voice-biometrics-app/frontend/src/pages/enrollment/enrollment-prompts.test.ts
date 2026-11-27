import { ENROLLMENT_PROMPTS, promptForEnrollmentAttempt, promptForEnrollmentSample } from "./enrollment-prompts";

describe("enrollment prompts", () => {
  it("keeps the prompt stable for one enrollment attempt", () => {
    expect(promptForEnrollmentAttempt("attempt-00000001"))
      .toEqual(promptForEnrollmentAttempt("attempt-00000001"));
  });

  it("advances to a distinct stable prompt for each requested sample", () => {
    const promptIds = Array.from(
      { length: ENROLLMENT_PROMPTS.length },
      (_, index) => promptForEnrollmentSample("attempt-00000001", index + 1).id
    );
    expect(new Set(promptIds).size).toBe(ENROLLMENT_PROMPTS.length);
    expect(promptForEnrollmentSample("attempt-00000001", 2))
      .toEqual(promptForEnrollmentSample("attempt-00000001", 2));
    expect(promptForEnrollmentSample("attempt-00000001", ENROLLMENT_PROMPTS.length + 1))
      .toEqual(promptForEnrollmentSample("attempt-00000001", 1));
  });

  it("rejects an invalid sample ordinal", () => {
    expect(() => promptForEnrollmentSample("attempt-00000001", 0)).toThrow(RangeError);
    expect(() => promptForEnrollmentSample("attempt-00000001", 1.5)).toThrow(RangeError);
  });

  it("varies prompts across enrollment attempts and provides a repeat sentence", () => {
    const selected = new Set(
      Array.from({ length: 24 }, (_, index) => promptForEnrollmentAttempt(`attempt-${index}`).id)
    );
    expect(selected.size).toBeGreaterThan(1);
    expect(ENROLLMENT_PROMPTS.every((prompt) => prompt.text.split(/\s+/).length >= 25)).toBe(true);
    expect(ENROLLMENT_PROMPTS.every((prompt) => prompt.text.includes(prompt.repeatText))).toBe(true);
  });
});
