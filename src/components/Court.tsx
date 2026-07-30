type CourtProps = {
  active: boolean;
  shots: { id: string; x?: number; y?: number; made: boolean; number?: number }[];
  onSelect: (x: number, y: number) => void;
};

export default function Court({ active, shots, onSelect }: CourtProps) {
  return (
    <button
      type="button"
      className={`court ${active ? "court--active" : ""}`}
      aria-label={active ? "Seleziona la posizione del tiro" : "Campo con shot chart"}
      onClick={(event) => {
        if (!active) return;
        const rect = event.currentTarget.getBoundingClientRect();
        onSelect(
          ((event.clientX - rect.left) / rect.width) * 100,
          ((event.clientY - rect.top) / rect.height) * 100,
        );
      }}
    >
      <svg viewBox="0 0 500 470" role="img" aria-label="Metà campo da basket">
        <rect x="3" y="3" width="494" height="464" rx="8" />
        <path d="M175 3v190h150V3M175 193h150" />
        <circle cx="250" cy="193" r="60" />
        <path d="M218 58h64M250 58v20M223 82a30 30 0 0 0 54 0" />
        <path d="M42 3v92a212 212 0 0 0 416 0V3" />
        <path d="M42 3v80M458 3v80" />
      </svg>
      {shots.map(
        (shot) =>
          shot.x !== undefined &&
          shot.y !== undefined && (
            <span
              key={shot.id}
              className={`shot-jersey ${shot.made ? "shot-jersey--made" : "shot-jersey--miss"}`}
              style={{ left: `${shot.x}%`, top: `${shot.y}%` }}
              aria-label={`Tiro ${shot.made ? "segnato" : "sbagliato"} del numero ${shot.number ?? "non assegnato"}`}
            >
              <span>{shot.number ?? "?"}</span>
            </span>
          ),
      )}
      {active && (
        <span className="court-prompt">
          <small>POSIZIONE TIRO</small>
          Tocca il campo
        </span>
      )}
    </button>
  );
}
