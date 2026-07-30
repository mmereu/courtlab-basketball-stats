import { describe, expect, it } from "vitest";
import { initialState, type GameEvent, type GameState } from "./domain";
import {
  buildVirtualVideoClips,
  emptyVideoAnalysis,
  estimateEventVideoSeconds,
  filterVideoEvents,
  normalizeVideoAnalysis,
} from "./videoAnalysis";

const events: GameEvent[] = [
  { id: "q1-shot", type: "2PT_MISS", playerId: "p4", period: 1, clock: 570, createdAt: 1, label: "2X", points: 0 },
  { id: "q1-reb", type: "OREB", playerId: "p7", period: 1, clock: 568, createdAt: 2, label: "RO", points: 0 },
  { id: "q2-shot", type: "3PT_MADE", playerId: "p4", period: 2, clock: 540, createdAt: 3, label: "3V", points: 3 },
  { id: "opp", type: "TOV", playerId: "opp-1", period: 2, clock: 530, createdAt: 4, label: "PP", points: 0, isOpponent: true },
];

const state: GameState = {
  ...initialState,
  events,
  videoAnalysis: {
    fileName: "partita.mp4",
    durationSeconds: 1800,
    periodAnchors: [
      { period: 1, clock: 600, videoSeconds: 10 },
      { period: 2, clock: 600, videoSeconds: 700 },
    ],
    eventLinks: { "q1-shot": 45 },
    eventNotes: { "q1-shot": "Tiro ben costruito" },
  },
};

describe("analisi video locale", () => {
  it("mantiene compatibili gli state precedenti e crea metadati senza file", () => {
    expect(normalizeVideoAnalysis(undefined)).toBeUndefined();
    expect(emptyVideoAnalysis("gara.mov", 123)).toEqual({
      fileName: "gara.mov",
      durationSeconds: 123,
      periodAnchors: [],
      eventLinks: {},
      eventNotes: {},
    });
  });

  it("ripulisce salvataggi parziali o non validi", () => {
    expect(normalizeVideoAnalysis({
      fileName: "gara.mp4",
      durationSeconds: -2,
      periodAnchors: [{ period: 1, clock: 600, videoSeconds: 4 }, { period: 0, clock: 0, videoSeconds: 0 }],
      eventLinks: { ok: 12, bad: -1 },
      eventNotes: { ok: "  nota  ", empty: " " },
    })).toEqual({
      fileName: "gara.mp4",
      durationSeconds: 0,
      periodAnchors: [{ period: 1, clock: 600, videoSeconds: 4 }],
      eventLinks: { ok: 12 },
      eventNotes: { ok: "nota" },
    });
  });

  it("preferisce il link esatto e stima dagli ancoraggi più vicini", () => {
    expect(estimateEventVideoSeconds(state, "q1-shot")).toBe(45);
    expect(estimateEventVideoSeconds(state, "q1-reb")).toBe(47);
    expect(estimateEventVideoSeconds(state, "q2-shot")).toBe(760);
    expect(estimateEventVideoSeconds({ events, videoAnalysis: undefined }, "q1-shot")).toBeUndefined();
  });

  it("filtra per tipo, giocatore, periodo e lato", () => {
    expect(filterVideoEvents(events, {
      eventTypes: ["2PT_MISS", "3PT_MADE"],
      playerIds: ["p4"],
      periods: [2],
      opponent: false,
    }).map((event) => event.id)).toEqual(["q2-shot"]);
    expect(filterVideoEvents(events, { opponent: true }).map((event) => event.id)).toEqual(["opp"]);
  });

  it("costruisce clip virtuali ordinate con preroll, postroll, note e stima", () => {
    const clips = buildVirtualVideoClips(state, { playerIds: ["p4"] }, 8, 5);
    expect(clips.map((clip) => clip.event.id)).toEqual(["q1-shot", "q2-shot"]);
    expect(clips[0]).toMatchObject({
      videoSeconds: 45,
      startSeconds: 37,
      endSeconds: 50,
      note: "Tiro ben costruito",
      estimated: false,
    });
    expect(clips[1]).toMatchObject({
      videoSeconds: 760,
      startSeconds: 752,
      endSeconds: 765,
      estimated: true,
    });
  });

  it("limita clip e stime ai confini del video", () => {
    const short = {
      ...state,
      videoAnalysis: {
        ...state.videoAnalysis!,
        durationSeconds: 50,
        eventLinks: { "q1-shot": 2, "q2-shot": 49 },
      },
    };
    const clips = buildVirtualVideoClips(short, {}, 8, 8);
    expect(clips.find((clip) => clip.event.id === "q1-shot")).toMatchObject({ startSeconds: 0 });
    expect(clips.find((clip) => clip.event.id === "q2-shot")).toMatchObject({ endSeconds: 50 });
  });
});
