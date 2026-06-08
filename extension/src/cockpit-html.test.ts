import { describe, it, expect } from "vitest";
import { buildHtml, getNonce, STUB_WAVES } from "./cockpit-html";

describe("getNonce", () => {
  it("returns a 32-char token", () => {
    expect(getNonce()).toHaveLength(32);
  });
  it("returns a different value each call", () => {
    expect(getNonce()).not.toEqual(getNonce());
  });
});

describe("buildHtml", () => {
  const html = buildHtml({
    scriptUri: "https://vscode-resource/main.js",
    styleUri: "https://vscode-resource/main.css",
    cspSource: "vscode-resource:",
    nonce: "TESTNONCE",
  });

  it("locks scripts to the nonce in both the CSP and the script tag", () => {
    expect(html).toContain("script-src 'nonce-TESTNONCE'");
    expect(html).toContain('<script nonce="TESTNONCE" src="https://vscode-resource/main.js">');
  });
  it("denies everything by default and links the stylesheet", () => {
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('href="https://vscode-resource/main.css"');
  });
  it("mounts a #root for React", () => {
    expect(html).toContain('<div id="root"></div>');
  });
});

describe("STUB_WAVES", () => {
  it("has three waves with at least one ticket each", () => {
    expect(STUB_WAVES).toHaveLength(3);
    for (const wave of STUB_WAVES) {
      expect(wave.tickets.length).toBeGreaterThan(0);
    }
  });
  it("uses only valid priority and state values", () => {
    const priorities = new Set(["urgent", "high", "med", "low"]);
    const states = new Set(["todo", "doing", "done"]);
    for (const wave of STUB_WAVES) {
      for (const t of wave.tickets) {
        expect(priorities.has(t.priority)).toBe(true);
        expect(states.has(t.state)).toBe(true);
      }
    }
  });
});
