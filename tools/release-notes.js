#!/usr/bin/env node
/**
 * Prints the GitHub release notes for a version: its CHANGELOG.md section
 * plus links to npm and to the diff from the previous release.
 *
 *   node tools/release-notes.js                  # version of packages/cli
 *   node tools/release-notes.js 2.0.0-beta.20
 *   node tools/release-notes.js --check          # only verify the section exists
 *   node tools/release-notes.js 2.0.0-beta.20 --previous=2.0.0-beta.19
 *
 * The diff link starts at --previous (the last release); without it, at the
 * next older CHANGELOG.md section.
 *
 * Exits with 1 when CHANGELOG.md has no `## v<version>` section.
 */
const fs = require("fs");
const path = require("path");

const REPO = "https://github.com/qodalis-solutions/web-cli";
const root = path.resolve(__dirname, "..");

function currentVersion() {
  const pkg = path.join(root, "packages/cli/package.json");
  return JSON.parse(fs.readFileSync(pkg, "utf8")).version;
}

/** `## v1.2.3` or `## [v1.2.3](...) (date)` -> `1.2.3` */
function headingVersion(line) {
  const match = /^## \[?v([^\]\s)]+)/.exec(line);
  return match ? match[1] : undefined;
}

function changelogSection(version) {
  const lines = fs
    .readFileSync(path.join(root, "CHANGELOG.md"), "utf8")
    .split(/\r?\n/);
  const start = lines.findIndex((line) => headingVersion(line) === version);
  if (start < 0) return undefined;
  let end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
  if (end < 0) end = lines.length;
  return {
    body: lines.slice(start + 1, end).join("\n").trim(),
    previous: end < lines.length ? headingVersion(lines[end]) : undefined,
  };
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const version = args.find((a) => !a.startsWith("--")) || currentVersion();
  const previousArg = args.find((a) => a.startsWith("--previous="));

  const section = changelogSection(version);
  if (!section || !section.body) {
    console.error(
      `CHANGELOG.md has no "## v${version}" section: add the release notes before releasing.`,
    );
    process.exit(1);
  }
  if (check) {
    console.log(`CHANGELOG.md has release notes for v${version}.`);
    return;
  }

  const links = [
    `**npm:** [\`@qodalis/cli@${version}\`](https://www.npmjs.com/package/@qodalis/cli/v/${version}) and the other \`@qodalis/*\` packages at ${version}`,
  ];
  const previous = previousArg
    ? previousArg.slice("--previous=".length).replace(/^v/, "")
    : section.previous;
  if (previous) {
    links.push(
      `**Full diff:** [v${previous}...v${version}](${REPO}/compare/v${previous}...v${version})`,
    );
  }
  process.stdout.write(`${section.body}\n\n---\n\n${links.join("\n\n")}\n`);
}

main();
