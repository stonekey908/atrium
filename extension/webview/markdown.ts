/**
 * Markdown rendering for Linear content (STO-2494). Descriptions and criteria
 * are Linear-authored markdown; we render them like Linear does instead of
 * showing raw `**bold**` text. Raw HTML embedded in the markdown is ESCAPED,
 * never rendered — combined with the webview's nonce-only script CSP, that
 * keeps dangerouslySetInnerHTML safe.
 */
import { marked } from "marked";

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }: { text: string }) {
      return escapeHtml(text);
    },
  },
});

/** Full block rendering — the ticket modal body. */
export function mdToHtml(md: string): string {
  return marked.parse(md, { async: false });
}

/** Inline-only rendering (no <p> wrappers) — Plan criteria lines. */
export function mdInlineToHtml(text: string): string {
  return marked.parseInline(text, { async: false });
}
