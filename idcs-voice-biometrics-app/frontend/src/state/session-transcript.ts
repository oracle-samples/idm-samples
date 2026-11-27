import type { TranscriptUpdate } from "../services/voice-socket";

export function mergeTranscriptSegment(
  segments: readonly TranscriptUpdate[],
  update: TranscriptUpdate
): readonly TranscriptUpdate[] {
  const currentIndex = segments.findIndex((segment) => segment.utteranceId === update.utteranceId);
  if (currentIndex >= 0) {
    const current = segments[currentIndex];
    if (!current || current.final || update.revision <= current.revision) return segments;
    const next = [...segments];
    next[currentIndex] = update;
    return ordered(next);
  }
  return ordered([...segments, update]);
}

function ordered(segments: TranscriptUpdate[]): readonly TranscriptUpdate[] {
  return segments.sort((left, right) =>
    left.startAudioSequence - right.startAudioSequence ||
    left.endAudioSequence - right.endAudioSequence ||
    left.utteranceId.localeCompare(right.utteranceId));
}
