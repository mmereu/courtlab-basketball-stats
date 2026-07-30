import {
  elapsedGameSeconds,
  type EventType,
  type GameEvent,
  type GameState,
  type LocalVideoAnalysis,
  type VideoPeriodAnchor,
} from "./domain";

export type VideoEventFilters = {
  eventTypes?: EventType[];
  playerIds?: string[];
  periods?: number[];
  opponent?: boolean;
};

export type VirtualVideoClip = {
  event: GameEvent;
  videoSeconds: number;
  startSeconds: number;
  endSeconds: number;
  note?: string;
  estimated: boolean;
};

const finiteNonNegative = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;

export function emptyVideoAnalysis(
  fileName = "",
  durationSeconds = 0,
): LocalVideoAnalysis {
  return {
    fileName,
    durationSeconds: finiteNonNegative(durationSeconds),
    periodAnchors: [],
    eventLinks: {},
    eventNotes: {},
  };
}

/**
 * Normalizza dati provenienti da salvataggi locali precedenti o parziali.
 * I vecchi GameState, privi di videoAnalysis, restano validi.
 */
export function normalizeVideoAnalysis(value: unknown): LocalVideoAnalysis | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<LocalVideoAnalysis>;
  const periodAnchors = Array.isArray(raw.periodAnchors)
    ? raw.periodAnchors
      .filter((anchor): anchor is VideoPeriodAnchor => Boolean(
        anchor
        && Number.isInteger(anchor.period)
        && anchor.period > 0
        && Number.isFinite(anchor.clock)
        && anchor.clock >= 0
        && Number.isFinite(anchor.videoSeconds)
        && anchor.videoSeconds >= 0,
      ))
      .map((anchor) => ({ ...anchor }))
    : [];
  const numericRecord = (record: unknown) => Object.fromEntries(
    Object.entries(record && typeof record === "object" ? record : {})
      .filter(([, seconds]) => typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0),
  ) as Record<string, number>;
  const textRecord = (record: unknown) => Object.fromEntries(
    Object.entries(record && typeof record === "object" ? record : {})
      .filter(([, note]) => typeof note === "string" && note.trim())
      .map(([id, note]) => [id, (note as string).trim()]),
  );
  return {
    fileName: typeof raw.fileName === "string" ? raw.fileName : "",
    durationSeconds: finiteNonNegative(raw.durationSeconds),
    periodAnchors,
    eventLinks: numericRecord(raw.eventLinks),
    eventNotes: textRecord(raw.eventNotes),
  };
}

export function videoAnalysisFromState(state: Pick<GameState, "videoAnalysis">) {
  return normalizeVideoAnalysis(state.videoAnalysis);
}

function clampVideoSeconds(seconds: number, durationSeconds: number) {
  return Math.max(0, durationSeconds > 0 ? Math.min(seconds, durationSeconds) : seconds);
}

/**
 * Stima la posizione usando prima un link esatto e poi il riferimento
 * temporalmente più vicino tra link evento e ancore di periodo.
 */
export function estimateEventVideoSeconds(
  state: Pick<GameState, "events" | "videoAnalysis">,
  eventOrId: GameEvent | string,
): number | undefined {
  const analysis = videoAnalysisFromState(state);
  if (!analysis) return undefined;
  const event = typeof eventOrId === "string"
    ? state.events.find((candidate) => candidate.id === eventOrId)
    : eventOrId;
  if (!event) return undefined;
  const exact = analysis.eventLinks[event.id];
  if (exact !== undefined) return clampVideoSeconds(exact, analysis.durationSeconds);

  const targetGameSeconds = elapsedGameSeconds(event.period, event.clock);
  const candidates: Array<{ gameSeconds: number; videoSeconds: number }> = [];
  analysis.periodAnchors.forEach((anchor) => {
    candidates.push({
      gameSeconds: elapsedGameSeconds(anchor.period, anchor.clock),
      videoSeconds: anchor.videoSeconds,
    });
  });
  Object.entries(analysis.eventLinks).forEach(([eventId, videoSeconds]) => {
    const linked = state.events.find((candidate) => candidate.id === eventId);
    if (linked) {
      candidates.push({
        gameSeconds: elapsedGameSeconds(linked.period, linked.clock),
        videoSeconds,
      });
    }
  });
  const nearest = candidates.sort(
    (a, b) =>
      Math.abs(a.gameSeconds - targetGameSeconds) - Math.abs(b.gameSeconds - targetGameSeconds),
  )[0];
  if (!nearest) return undefined;
  return clampVideoSeconds(
    nearest.videoSeconds + targetGameSeconds - nearest.gameSeconds,
    analysis.durationSeconds,
  );
}

export function filterVideoEvents(events: GameEvent[], filters: VideoEventFilters = {}) {
  const types = new Set(filters.eventTypes ?? []);
  const players = new Set(filters.playerIds ?? []);
  const periods = new Set(filters.periods ?? []);
  return events.filter((event) =>
    (!types.size || types.has(event.type))
    && (!players.size || Boolean(event.playerId && players.has(event.playerId)))
    && (!periods.size || periods.has(event.period))
    && (filters.opponent === undefined || Boolean(event.isOpponent) === filters.opponent));
}

export function buildVirtualVideoClips(
  state: Pick<GameState, "events" | "videoAnalysis">,
  filters: VideoEventFilters = {},
  preRollSeconds = 6,
  postRollSeconds = 4,
): VirtualVideoClip[] {
  const analysis = videoAnalysisFromState(state);
  if (!analysis) return [];
  const pre = finiteNonNegative(preRollSeconds);
  const post = finiteNonNegative(postRollSeconds);
  return filterVideoEvents(state.events, filters)
    .map((event): VirtualVideoClip | undefined => {
      const videoSeconds = estimateEventVideoSeconds(state, event);
      if (videoSeconds === undefined) return undefined;
      return {
        event,
        videoSeconds,
        startSeconds: clampVideoSeconds(videoSeconds - pre, analysis.durationSeconds),
        endSeconds: clampVideoSeconds(videoSeconds + post, analysis.durationSeconds),
        note: analysis.eventNotes[event.id],
        estimated: analysis.eventLinks[event.id] === undefined,
      };
    })
    .filter((clip): clip is VirtualVideoClip => Boolean(clip))
    .sort((a, b) => a.videoSeconds - b.videoSeconds);
}
