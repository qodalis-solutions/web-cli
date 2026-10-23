#!/usr/bin/env bash
# Release: fast-forward main to develop, so both branches keep one linear history.
#
#   pnpm run release            # check, then push origin/develop to main
#   pnpm run release --dry-run  # only check
#
# Pushing main publishes to npm and creates the tag and GitHub release
# (.github/workflows/deploy.yml). Needs admin rights on the repository: the
# "main changes" ruleset lets admins push to main without a PR; force pushes
# stay blocked, so main can only move forward.
set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

fail() { echo "release: $*" >&2; exit 1; }

git fetch --quiet origin main develop
DEVELOP=$(git rev-parse origin/develop)
MAIN=$(git rev-parse origin/main)

[[ "$DEVELOP" != "$MAIN" ]] || fail "main is already at develop ($DEVELOP); nothing to release."
git merge-base --is-ancestor "$MAIN" "$DEVELOP" \
    || fail "main is not an ancestor of develop, so it cannot be fast-forwarded. Align the branches first."

VERSION=$(git show "$DEVELOP:packages/cli/package.json" | node -p "JSON.parse(require('fs').readFileSync(0, 'utf8')).version")
# grep reads all of its input: with -q it would stop at the first match and
# git show would die of SIGPIPE, which pipefail reports as a failure
git show "$DEVELOP:CHANGELOG.md" | grep -E "^## \[?v${VERSION//./\\.}([] ]|$)" > /dev/null \
    || fail "CHANGELOG.md on develop has no '## v$VERSION' section."

# develop's own CI run (the push, or a manual run on develop) must have passed for this exact commit
if command -v gh > /dev/null; then
    CONCLUSION=$(gh run list --branch develop --commit "$DEVELOP" --workflow build.yml --limit 20 \
        --json event,conclusion --jq '[.[] | select(.event == "push" or .event == "workflow_dispatch")][0].conclusion // ""')
    [[ "$CONCLUSION" == "success" ]] \
        || fail "CI on develop ($DEVELOP) is '${CONCLUSION:-not run}', not 'success'. Wait for it or fix it (no run? gh workflow run build.yml --ref develop)."
else
    echo "release: gh not installed, skipping the CI check" >&2
fi

echo "Releasing v$VERSION: main $(git rev-parse --short "$MAIN") -> $(git rev-parse --short "$DEVELOP")"
git log --oneline "$MAIN..$DEVELOP"

if $DRY_RUN; then
    echo "Dry run: not pushing."
    exit 0
fi
# Fast-forward only: the "main history" ruleset rejects anything else
git push origin "$DEVELOP:refs/heads/main"
