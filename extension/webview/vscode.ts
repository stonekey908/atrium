/**
 * Thin wrapper around the VS Code webview API. `acquireVsCodeApi` is injected
 * into the webview sandbox by VS Code and may only be called once per document,
 * so we capture it as a module singleton.
 */
export interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare global {
  function acquireVsCodeApi(): VsCodeApi;
}

export const vscode: VsCodeApi = acquireVsCodeApi();
