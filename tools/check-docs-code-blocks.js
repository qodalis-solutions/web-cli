#!/usr/bin/env node
/**
 * Fails when a docs code block (<pre><code> in apps/docs templates) carries the
 * template's indentation: inside <pre> every space is shown, so lines 2..n must
 * be written flush left, not indented like the surrounding HTML.
 *
 *   node tools/check-docs-code-blocks.js
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../apps/docs/src");
const BLOCK = /<pre[^>]*>(?:\s*<code[^>]*>)?([\s\S]*?)<\/(?:code|pre)>/g;

function* templates(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* templates(full);
    else if (entry.name.endsWith(".html")) yield full;
  }
}

const problems = [];
for (const file of templates(root)) {
  const src = fs.readFileSync(file, "utf8");
  for (const match of src.matchAll(BLOCK)) {
    const lines = match[1].split("\n");
    if (lines.length < 2) continue;
    const lineStart = src.lastIndexOf("\n", match.index) + 1;
    const templateIndent = /^\s*/.exec(src.slice(lineStart, match.index))[0].length;
    const indents = lines
      .slice(1)
      .filter((line) => line.trim())
      .map((line) => /^\s*/.exec(line)[0].length);
    // Every continuation line at least as deep as the <pre> line: template indentation leaked in
    if (templateIndent > 0 && indents.length && Math.min(...indents) >= templateIndent) {
      const line = src.slice(0, match.index).split("\n").length;
      problems.push(`${path.relative(process.cwd(), file)}:${line}: ${lines[0].trim().slice(0, 60)}`);
    }
  }
}

if (problems.length) {
  console.error(
    "Code blocks indented like the template (inside <pre> that indentation is shown):\n  " +
      problems.join("\n  ") +
      "\nWrite the code flush left, with its own indentation only.",
  );
  process.exit(1);
}
console.log("Docs code blocks: indentation OK.");
