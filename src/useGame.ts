import { useEffect, useRef, useState } from "react";
import { GameEvent, GameState, initialState } from "./domain";

export function useGame() {
  const [state, setState] = useState<GameState>(initialState);
  const intervalRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (state.running && state.clock > 0) {
      intervalRef.current = window.setInterval(() => {
        setState((current) => ({
          ...current,
          clock: Math.max(0, current.clock - 1),
          periodClocks: {
            ...current.periodClocks,
            [current.period]: Math.max(0, current.clock - 1),
          },
          running: current.clock > 1,
        }));
      }, 1000);
    }
    return () => window.clearInterval(intervalRef.current);
  }, [state.running, state.clock === 0]);

  const patch = (value: Partial<GameState>) =>
    setState((current) => ({ ...current, ...value }));

  const addEvent = (event: Omit<GameEvent, "id" | "createdAt" | "period" | "clock">) =>
    setState((current) => ({
      ...current,
      selectedPlayerId: undefined,
      events: [
        ...current.events,
        {
          ...event,
          id: crypto.randomUUID(),
          period: current.period,
          clock: current.clock,
          createdAt: Date.now(),
        },
      ],
    }));

  const undo = () =>
    setState((current) => ({ ...current, events: current.events.slice(0, -1) }));

  const updateEvent = (id: string, patch: Partial<GameEvent>) =>
    setState((current) => ({
      ...current,
      events: current.events.map((event) =>
        event.id === id ? { ...event, ...patch, id: event.id, revisedAt: Date.now() } : event),
    }));

  const deleteEvent = (id: string) =>
    setState((current) => ({
      ...current,
      events: current.events.filter((event) => event.id !== id),
    }));

  const reset = () => {
    setState(initialState);
  };

  const load = (next: GameState) => setState({ ...next, running: false });

  return { state, setState, patch, addEvent, updateEvent, deleteEvent, undo, reset, load };
}
