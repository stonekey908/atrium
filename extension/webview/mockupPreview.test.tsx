import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";

const { postMessage } = vi.hoisted(() => ({ postMessage: vi.fn() }));
vi.mock("./vscode", () => ({
  vscode: { postMessage, getState: () => undefined, setState: () => undefined },
}));

import { MockupPreview } from "./MockupPreview";

const PATH = "/repo/files/horizon.html";

function sendContent(payload: { path: string; content?: string; error?: string }) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data: { type: "fileContent", ...payload } }));
  });
}

describe("MockupPreview (STO-2479)", () => {
  beforeEach(() => postMessage.mockClear());

  it("requests the file from the host on mount and shows a loading state", () => {
    render(<MockupPreview path={PATH} title="horizon.html" />);
    expect(postMessage).toHaveBeenCalledWith({ type: "previewFile", path: PATH });
    expect(screen.getByText(/loading preview/i)).toBeInTheDocument();
  });

  it("renders the file content in a sandboxed iframe", () => {
    render(<MockupPreview path={PATH} title="horizon.html" />);
    sendContent({ path: PATH, content: "<html><body>mock</body></html>" });
    const frame = screen.getByTitle("horizon.html") as HTMLIFrameElement;
    expect(frame.tagName).toBe("IFRAME");
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("srcdoc")).toContain("mock");
  });

  it("re-renders when the host pushes updated content (file changed)", () => {
    render(<MockupPreview path={PATH} title="horizon.html" />);
    sendContent({ path: PATH, content: "<html>v1</html>" });
    sendContent({ path: PATH, content: "<html>v2</html>" });
    const frame = screen.getByTitle("horizon.html") as HTMLIFrameElement;
    expect(frame.getAttribute("srcdoc")).toContain("v2");
  });

  it("ignores content for other paths", () => {
    render(<MockupPreview path={PATH} title="horizon.html" />);
    sendContent({ path: "/repo/other.html", content: "<html>other</html>" });
    expect(screen.getByText(/loading preview/i)).toBeInTheDocument();
  });

  it("shows the host's error instead of an iframe", () => {
    render(<MockupPreview path={PATH} title="horizon.html" />);
    sendContent({ path: PATH, error: "File is outside the workspace." });
    expect(screen.getByRole("alert")).toHaveTextContent(/outside the workspace/i);
    expect(screen.queryByTitle("horizon.html")).not.toBeInTheDocument();
  });
});
