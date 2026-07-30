import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { EventType, formatClock, GameEvent, GameState, LocalVideoAnalysis } from "../domain";
import { emptyVideoAnalysis, estimateEventVideoSeconds } from "../videoAnalysis";

export type VideoAnalysisProps = {
  state: GameState;
  onChange: (value: LocalVideoAnalysis) => void;
  readOnly?: boolean;
};

type Clip = { event: GameEvent; at: number };

const eventLabels: Partial<Record<EventType, string>> = {
  "1PT_MADE": "TL segnato", "1PT_MISS": "TL sbagliato",
  "2PT_MADE": "2 punti segnato", "2PT_MISS": "2 punti sbagliato",
  "3PT_MADE": "3 punti segnato", "3PT_MISS": "3 punti sbagliato",
  OREB: "Rimbalzo offensivo", DREB: "Rimbalzo difensivo", AST: "Assist",
  STL: "Palla recuperata", TOV: "Palla persa", BLK: "Stoppata fatta",
  BLK_AGAINST: "Stoppata subita", FOUL: "Fallo commesso",
  FOUL_DRAWN: "Fallo subito", SCORE_ADJUST: "Correzione punteggio",
};

const periodDuration = (period: number) => period <= 4 ? 600 : 300;
const periodName = (period: number) => period <= 4 ? `Q${period}` : `OT${period - 4}`;

export default function VideoAnalysis({
  state, onChange, readOnly = false,
}: VideoAnalysisProps) {
  const events = state.events;
  const roster = state.roster;
  const periods = Math.max(4, state.period, ...events.map((event) => event.period));
  const value = state.videoAnalysis ?? emptyVideoAnalysis();
  const videoRef = useRef<HTMLVideoElement>(null);
  const objectUrlRef = useRef<string | undefined>(undefined);
  const clipTimerRef = useRef<number | undefined>(undefined);
  const [videoUrl, setVideoUrl] = useState("");
  const [playerId, setPlayerId] = useState("all");
  const [period, setPeriod] = useState("all");
  const [eventType, setEventType] = useState("all");
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const [playlistIndex, setPlaylistIndex] = useState<number>();
  const [preRoll, setPreRoll] = useState(5);
  const [postRoll, setPostRoll] = useState(8);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    if (clipTimerRef.current) window.clearTimeout(clipTimerRef.current);
  }, []);

  const patch = (next: Partial<LocalVideoAnalysis>) => onChange({ ...value, ...next });
  const players = useMemo(() => new Map(roster.map((player) => [player.id, player])), [roster]);
  const eventTypes = useMemo(() =>
    [...new Set(events.filter((event) => eventLabels[event.type]).map((event) => event.type))],
  [events]);
  const filteredEvents = useMemo(() => events
    .filter((event) => eventLabels[event.type])
    .filter((event) => playerId === "all" || event.playerId === playerId)
    .filter((event) => period === "all" || event.period === Number(period))
    .filter((event) => eventType === "all" || event.type === eventType)
    .sort((a, b) => a.period - b.period || b.clock - a.clock),
  [events, eventType, period, playerId]);

  const eventTime = (event: GameEvent) => {
    return estimateEventVideoSeconds({ ...state, videoAnalysis: value }, event);
  };
  const clips = useMemo(() => filteredEvents
    .map((event) => ({ event, at: eventTime(event) }))
    .filter((clip): clip is Clip => clip.at !== undefined),
  // eventTime intentionally follows persisted anchors.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [filteredEvents, value.eventLinks, value.periodAnchors]);

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setVideoUrl(objectUrlRef.current);
    setPlaylistIndex(undefined);
    patch({ fileName: file.name });
  };
  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + seconds));
  };
  const seekToEvent = (event: GameEvent) => {
    const at = eventTime(event);
    setSelectedEventId(event.id);
    if (at === undefined || !videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, at - preRoll);
  };
  const anchorPeriod = (targetPeriod: number) => {
    const video = videoRef.current;
    if (!video) return;
    patch({
      periodAnchors: [
        ...value.periodAnchors.filter((anchor) => anchor.period !== targetPeriod),
        { period: targetPeriod, clock: periodDuration(targetPeriod), videoSeconds: video.currentTime },
      ],
    });
  };
  const anchorEvent = (event: GameEvent) => {
    const video = videoRef.current;
    if (!video) return;
    setSelectedEventId(event.id);
    patch({ eventLinks: { ...value.eventLinks, [event.id]: video.currentTime } });
  };
  const updateNote = (eventId: string, note: string) =>
    patch({ eventNotes: { ...value.eventNotes, [eventId]: note } });

  const playClip = (index: number) => {
    const video = videoRef.current;
    const clip = clips[index];
    if (!video || !clip) {
      setPlaylistIndex(undefined);
      return;
    }
    if (clipTimerRef.current) window.clearTimeout(clipTimerRef.current);
    setPlaylistIndex(index);
    setSelectedEventId(clip.event.id);
    const start = Math.max(0, clip.at - preRoll);
    const end = clip.at + postRoll;
    video.currentTime = start;
    void video.play();
    clipTimerRef.current = window.setTimeout(() => {
      video.pause();
      playClip(index + 1);
    }, Math.max(500, (end - start) * 1000));
  };
  const selected = events.find((event) => event.id === selectedEventId);

  return (
    <section className="analysis-card video-analysis" aria-labelledby="video-analysis-title">
      <div className="analysis-heading video-analysis-heading">
        <div>
          <p className="eyebrow">VIDEO LOCALE</p>
          <h2 id="video-analysis-title">Analisi video locale</h2>
          <p className="video-privacy">Il filmato resta su questo dispositivo e non viene caricato online.</p>
        </div>
        <label className="primary-button video-file-button" aria-label="Seleziona video locale">
          {videoUrl ? "Cambia video" : "Seleziona video"}
          <input type="file" accept="video/*" onChange={chooseFile} disabled={readOnly} aria-label="Seleziona video locale" />
        </label>
      </div>

      <div className="video-analysis-grid">
        <div className="video-player-panel">
          {videoUrl
            ? <video
                ref={videoRef}
                className="video-player"
                src={videoUrl}
                controls
                playsInline
                onLoadedMetadata={(event) => {
                  const duration = event.currentTarget.duration;
                  patch({ durationSeconds: Number.isFinite(duration) ? duration : 0 });
                }}
              />
            : <div className="video-placeholder">
                <strong>{value.fileName ? "Riseleziona il video locale" : "Nessun video selezionato"}</strong>
                <span>{value.fileName ? "I collegamenti sono salvi; il filmato non è stato archiviato." : "Scegli il file completo della partita."}</span>
              </div>}
          <div className="video-transport" aria-label="Comandi video">
            <button type="button" onClick={() => seek(-5)} disabled={!videoUrl}>−5s</button>
            <button type="button" onClick={() => seek(-1)} disabled={!videoUrl}>−1s</button>
            {[0.25, 0.5, 1, 1.5].map((speed) =>
              <button type="button" key={speed} disabled={!videoUrl}
                onClick={() => { if (videoRef.current) videoRef.current.playbackRate = speed; }}>
                {speed}×
              </button>)}
            <button type="button" onClick={() => seek(1)} disabled={!videoUrl}>+1s</button>
            <button type="button" onClick={() => seek(5)} disabled={!videoUrl}>+5s</button>
          </div>
          <div className="video-period-sync">
            <span>Inizio periodo al momento attuale:</span>
            {Array.from({ length: periods }, (_, index) => index + 1).map((item) =>
              <button type="button" key={item} disabled={!videoUrl || readOnly} className={value.periodAnchors.some((anchor) => anchor.period === item) ? "is-synced" : ""}
                onClick={() => anchorPeriod(item)}>
                Imposta inizio {periodName(item)}{value.periodAnchors.some((anchor) => anchor.period === item) ? " ✓" : ""}
              </button>)}
          </div>
          {value.fileName && <p className="video-file-name" title={value.fileName}>
            File: {value.fileName} · {formatClock(Math.round(value.durationSeconds))}
          </p>}
          {value.periodAnchors.length > 0 && <div className="video-anchor-summary">
            {[...value.periodAnchors].sort((a, b) => a.period - b.period).map((anchor) => (
              <span key={anchor.period}>{periodName(anchor.period)} · {formatClock(Math.round(anchor.videoSeconds))}</span>
            ))}
          </div>}
        </div>

        <div className="video-events-panel">
          <div className="video-filters">
            <label>Giocatore<select value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
              <option value="all">Tutti</option>
              {roster.map((player) => <option key={player.id} value={player.id}>#{player.number} {player.name}</option>)}
            </select></label>
            <label>Periodo<select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="all">Tutta la gara</option>
              {Array.from({ length: periods }, (_, index) => index + 1).map((item) =>
                <option key={item} value={item}>{periodName(item)}</option>)}
            </select></label>
            <label>Tipo evento<select value={eventType} onChange={(event) => setEventType(event.target.value)}>
              <option value="all">Tutte</option>
              {eventTypes.map((type) => <option key={type} value={type}>{eventLabels[type]}</option>)}
            </select></label>
          </div>
          <div className="video-playlist-tools">
            <span>{clips.length}/{filteredEvents.length} azioni sincronizzate</span>
            <label>Prima <input type="number" min="0" max="30" value={preRoll}
              onChange={(event) => setPreRoll(Number(event.target.value))} />s</label>
            <label>Dopo <input type="number" min="1" max="30" value={postRoll}
              onChange={(event) => setPostRoll(Number(event.target.value))} />s</label>
            <button type="button" className="secondary-button" disabled={!videoUrl || !clips.length}
              onClick={() => playlistIndex === undefined ? playClip(0) : (videoRef.current?.pause(), setPlaylistIndex(undefined))}>
              {playlistIndex === undefined ? "Riproduci playlist" : "Ferma playlist"}
            </button>
          </div>
          <div className="video-event-list">
            {filteredEvents.map((event) => {
              const player = event.playerId ? players.get(event.playerId) : undefined;
              const at = eventTime(event);
              const exact = value.eventLinks[event.id] !== undefined;
              return <article key={event.id} className={`video-event ${selectedEventId === event.id ? "is-selected" : ""}`}>
                <button type="button" className="video-event-main" onClick={() => seekToEvent(event)}>
                  <span className="video-event-clock">{periodName(event.period)} · {formatClock(event.clock)}</span>
                  <strong>{player ? `#${player.number} ${player.shortName}` : event.isOpponent ? "Avversari" : "Squadra"}</strong>
                  <span>{eventLabels[event.type] ?? event.label}</span>
                  <small>{at === undefined ? "Da sincronizzare" : `${exact ? "Associato" : "Stimato"} · ${formatClock(Math.round(at))}`}</small>
                </button>
                <button type="button" className="video-anchor-button" disabled={!videoUrl || readOnly}
                  onClick={() => anchorEvent(event)}>Associa</button>
              </article>;
            })}
            {!filteredEvents.length && <p className="analysis-empty">Nessuna azione corrisponde ai filtri.</p>}
          </div>
          {selected && <label className="video-note">
            Nota sull’azione
            <textarea value={value.eventNotes[selected.id] ?? ""} rows={3}
              placeholder="Aggiungi una nota tecnica o tattica…"
              disabled={readOnly}
              onChange={(event) => updateNote(selected.id, event.target.value)} />
          </label>}
        </div>
      </div>
    </section>
  );
}
