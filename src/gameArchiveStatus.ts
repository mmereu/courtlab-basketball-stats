import type { GameState } from "./domain";
import type { GameStatus } from "./models/archive";

/**
 * A completed game stays completed while a coach reopens it to correct events.
 * Only games that have never reached the report follow the current screen.
 */
export function statusAfterSave(current: GameStatus | undefined, screen: GameState["screen"]): GameStatus {
  if (current === "completed") return "completed";
  if (screen === "report") return "completed";
  if (screen === "live") return "live";
  return "draft";
}
