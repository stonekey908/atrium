import { describe, it, expect } from "vitest";
import { mdToHtml, mdInlineToHtml } from "./markdown";

describe("mdToHtml (STO-2494)", () => {
  it("renders block markdown — headings, bold, lists, code", () => {
    const html = mdToHtml("## Scope\n\nDo **this** with `that`\n\n- one\n- two");
    expect(html).toContain("<h2");
    expect(html).toContain("<strong>this</strong>");
    expect(html).toContain("<code>that</code>");
    expect(html).toContain("<li>one</li>");
  });

  it("renders links as anchors", () => {
    expect(mdToHtml("[Linear](https://linear.app)")).toContain('href="https://linear.app"');
  });

  it("escapes raw HTML instead of rendering it", () => {
    const html = mdToHtml('before <img src=x onerror="x()"> after');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

describe("mdInlineToHtml", () => {
  it("renders inline markdown without block wrappers", () => {
    const html = mdInlineToHtml("Do **this** with `that`");
    expect(html).toContain("<strong>this</strong>");
    expect(html).toContain("<code>that</code>");
    expect(html).not.toContain("<p>");
  });

  it("escapes raw HTML inline too", () => {
    expect(mdInlineToHtml("a <script>x</script> b")).not.toContain("<script>");
  });
});
