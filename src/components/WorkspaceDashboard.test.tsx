import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkspaceDashboard from "./WorkspaceDashboard";

describe("riepilogo stagione", () => {
  it("permette di scegliere tutte le finestre da 2 a 10 partite", () => {
    render(<WorkspaceDashboard
      teams={[{ id: "novara", name: "Basket Novara", season: "2026", color: "#f00", roster: [] }]}
      games={[]}
      selectedTeamId="novara"
      onSelectTeam={vi.fn()}
      onCreateTeam={vi.fn()}
      onUpdateTeam={vi.fn()}
      onCreateGame={vi.fn()}
      onOpenGame={vi.fn()}
      onAddPlayer={vi.fn()}
      onUpdatePlayer={vi.fn()}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Stagione" }));
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    for (let count = 2; count <= 10; count += 1) {
      expect(options).toContain(`Ultime ${count} partite`);
    }
  });
});
