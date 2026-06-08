import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuditRibbon } from "./ui";

describe("AuditRibbon", () => {
  it("fills steps present in the activity and outlines the missing ones", () => {
    render(<AuditRibbon activity={[{ kind: "pickup" }, { kind: "close" }]} labeled />);
    // Filled steps carry the plain label title; missing ones say "not yet recorded".
    expect(screen.getByTitle("Pickup")).toBeInTheDocument();
    expect(screen.getByTitle("Close")).toBeInTheDocument();
    expect(screen.getByTitle(/Plan locked — not yet recorded/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Phase end — not yet recorded/i)).toBeInTheDocument();
  });
});
