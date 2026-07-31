import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TesterLanding from "./TesterLanding";

afterEach(() => vi.restoreAllMocks());

describe("tester landing page", () => {
  it("explains the programme and submits a complete application", async () => {
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ received: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(<TesterLanding />);

    expect(screen.getByRole("heading", { name: /Prova CourtLab/i })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Nome e cognome"), { target: { value: "Coach Test" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "coach@example.test" } });
    fireEvent.change(screen.getByLabelText("Società"), { target: { value: "Basket Test" } });
    fireEvent.change(screen.getByLabelText("Squadra o categoria"), { target: { value: "Under 15" } });
    fireEvent.change(screen.getByLabelText("Ruolo"), { target: { value: "Allenatore" } });
    fireEvent.change(screen.getByLabelText("Dispositivo principale"), { target: { value: "Tablet" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Invia candidatura" }));

    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect(screen.getByRole("status").textContent).toContain("Candidatura ricevuta");
    const [, options] = request.mock.calls[0];
    expect(JSON.parse(String(options?.body))).toMatchObject({
      name: "Coach Test", email: "coach@example.test",
      organization: "Basket Test", consent: true,
    });
  });
});
