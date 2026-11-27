export interface EnrollmentPrompt {
  readonly id: string;
  readonly text: string;
  readonly repeatText: string;
}

export const ENROLLMENT_PROMPTS: readonly EnrollmentPrompt[] = [
  {
    id: "clear-communication",
    text: "Today I am registering my voice to support audit-oriented voice checks during future sessions. Clear communication helps important information be captured more accurately and securely.",
    repeatText: "Clear communication helps important information be captured more accurately and securely."
  },
  {
    id: "smooth-workflow",
    text: "During a live session, I speak clearly and naturally while listening carefully to each question. Audit voice checks support a smooth workflow and help keep attention on the conversation.",
    repeatText: "Audit voice checks support a smooth workflow and help keep attention on the conversation."
  },
  {
    id: "natural-voice",
    text: "Every conversation benefits from calm attention and clear communication. I am recording this sample in my natural voice so future sessions can compare speech with my enrolled voice profile.",
    repeatText: "I am recording this sample in my natural voice so future sessions can compare speech with my enrolled voice profile."
  },
  {
    id: "clear-sample",
    text: "My natural speaking voice helps support an efficient voice check session. I will continue reading at a comfortable pace until enough clear speech has been collected for my voice profile.",
    repeatText: "I will continue reading at a comfortable pace until enough clear speech has been collected for my voice profile."
  }
];

function promptStartIndex(attemptId: string): number {
  let hash = 2_166_136_261;
  for (const character of attemptId) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) % ENROLLMENT_PROMPTS.length;
}

export function promptForEnrollmentSample(
  attemptId: string,
  utteranceOrdinal: number
): EnrollmentPrompt {
  if (!Number.isSafeInteger(utteranceOrdinal) || utteranceOrdinal < 1) {
    throw new RangeError("Enrollment utterance ordinal must be a positive integer");
  }
  const sampleOffset = (utteranceOrdinal - 1) % ENROLLMENT_PROMPTS.length;
  const index = (promptStartIndex(attemptId) + sampleOffset) % ENROLLMENT_PROMPTS.length;
  return ENROLLMENT_PROMPTS[index] ?? ENROLLMENT_PROMPTS[0]!;
}

export function promptForEnrollmentAttempt(attemptId: string): EnrollmentPrompt {
  return promptForEnrollmentSample(attemptId, 1);
}
