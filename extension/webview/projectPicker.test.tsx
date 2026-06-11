import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { InitPayload } from "./types";

const { postMessage } = vi.hoisted(() => ({ postMessage: vi.fn() }));
vi.mock("./vscode", () => ({
  vscode: { postMessage, getState: () => undefined, setState: () => undefined },
}));

import { Cockpit } from "./Cockpit";

const BASE: InitPayload = {
  project: "Atrium",
  branch: "main",
  folders: ["Atrium"],
  waves: [],
  source: "live",
};

describe("header project picker (STO-2486)", () => {
  beforeEach(() => postMessage.mockClear());

  it("renders the project as plain text when no project list is available (snapshot mode)", () => {
    render(<Cockpit init={{ ...BASE, project: "Gemmy", source: "snapshot", projects: undefined }} />);
    expect(screen.queryByRole("combobox", { name: /linear project/i })).not.toBeInTheDocument();
    expect(screen.getByText("Gemmy")).toBeInTheDocument();
  });

  it("lists every Linear project with the current one selected", () => {
    render(<Cockpit init={{ ...BASE, projects: ["Atrium", "Gemmy"], projectSource: "detected" }} />);
    const select = screen.getByRole("combobox", { name: /linear project/i }) as HTMLSelectElement;
    expect(select.value).toBe("Atrium");
    expect(screen.getByRole("option", { name: "Gemmy" })).toBeInTheDocument();
  });

  it("posts selectProject when the user picks a different project", () => {
    render(<Cockpit init={{ ...BASE, projects: ["Atrium", "Gemmy"], projectSource: "detected" }} />);
    fireEvent.change(screen.getByRole("combobox", { name: /linear project/i }), {
      target: { value: "Gemmy" },
    });
    expect(postMessage).toHaveBeenCalledWith({ type: "selectProject", name: "Gemmy" });
  });

  it("shows a 'Choose project' placeholder when nothing matched the workspace", () => {
    render(
      <Cockpit
        init={{ ...BASE, project: "my-repo", projects: ["Atrium", "Gemmy"], projectSource: "none" }}
      />,
    );
    const select = screen.getByRole("combobox", { name: /linear project/i }) as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(screen.getByRole("option", { name: /choose project/i })).toBeInTheDocument();
  });
});
