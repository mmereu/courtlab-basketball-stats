import { describe, expect, it } from "vitest";
import { statusAfterSave } from "./gameArchiveStatus";

describe("stato partita archiviata", () => {
  it("non retrocede una partita terminata quando viene riaperta per correggerla", () => {
    expect(statusAfterSave("completed", "live")).toBe("completed");
    expect(statusAfterSave("completed", "setup")).toBe("completed");
  });

  it("termina una partita quando viene aperto il report", () => {
    expect(statusAfterSave("live", "report")).toBe("completed");
    expect(statusAfterSave("draft", "live")).toBe("live");
  });
});
