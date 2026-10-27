#!/usr/bin/env node
/**
 * Builds llms.txt and llms-full.txt (https://llmstxt.org) for the docs site from
 * the Markdown sources in docs/ai:
 *
 *   docs/ai/llms.md    -> llms.txt       (index of links)
 *   docs/ai/NN-*.md    -> llms-full.txt  (concatenated in file name order)
 *
 * The files are written to apps/docs/src/static, which the docs build copies to
 * the site root (https://cli.qodalis.com/llms.txt). They are generated, not
 * committed. llms-full.txt is consumed by @qodalis/mcp-cli, so its shape is
 * checked here (the build fails when it breaks):
 *   - the first line is "# Qodalis CLI plugin development", the only "# " heading;
 *   - sections are "## " headings, topics "### " headings, nothing deeper;
 *   - every topic starts with a one-line summary sentence;
 *   - every code fence names its language.
 *
 *   node tools/build-llms.js [outDir]
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "docs/ai");
const outDir = path.resolve(process.argv[2] || path.join(root, "apps/docs/src/static"));
const TITLE = "# Qodalis CLI plugin development";

const sources = fs
  .readdirSync(sourceDir)
  .filter((name) => /^\d+-.*\.md$/.test(name))
  .sort();
const full = sources.map((name) => fs.readFileSync(path.join(sourceDir, name), "utf8").trim()).join("\n\n") + "\n";

const problems = [];
const lines = full.split("\n");
if (lines[0] !== TITLE) problems.push(`line 1: expected "${TITLE}"`);

let inFence = false;
lines.forEach((line, i) => {
  const at = `line ${i + 1}`;
  if (/^\s*```/.test(line)) {
    if (!inFence && !/^\s*```\S+/.test(line)) problems.push(`${at}: code fence without a language`);
    inFence = !inFence;
    return;
  }
  if (inFence || !line.startsWith("#")) return;
  if (line.startsWith("# ") && i > 0) problems.push(`${at}: extra top-level heading "${line}"`);
  if (line.startsWith("####")) problems.push(`${at}: headings deeper than ### are not allowed`);
  if (line.startsWith("### ")) {
    const next = lines.slice(i + 1).find((l) => l.trim());
    if (!next || /^(#|```|[-*|>]|\d+\.)/.test(next.trim())) {
      problems.push(`${at}: topic "${line.slice(4)}" must start with a one-line summary sentence`);
    }
  }
});
if (inFence) problems.push("unclosed code fence");

if (problems.length) {
  console.error("llms-full.txt does not follow its contract:\n  " + problems.join("\n  "));
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "llms-full.txt"), full);
fs.copyFileSync(path.join(sourceDir, "llms.md"), path.join(outDir, "llms.txt"));

const topics = lines.filter((l) => l.startsWith("### ")).length;
console.log(`llms.txt and llms-full.txt (${sources.length} sources, ${topics} topics) -> ${path.relative(root, outDir)}`);
