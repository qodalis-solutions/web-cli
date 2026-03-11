# Yes/No Generator Plugin Design

## Command

`yesno [question]` — Generates a random yes/no answer with a slot machine animation.

## Behavior

1. **Optional question**: `yesno Should I deploy?` displays the question above the animation
2. **Slot machine animation**: Box frame rapidly cycles between YES and NO
3. **Deceleration**: Interval increases exponentially from ~60ms to ~400ms over ~2 seconds
4. **Final reveal**: Lands on random result with color (green=YES, red=NO)
5. **Result line**: Prints confirmation below the box

## Parameters

- `--count` / `-n` — Number of rounds (default 1). Each round animates independently.

## Animation Frames

```
  +-------+          +-------+
  | > YES |    ->    | >  NO |    ->  ...slowing...  ->  FINAL
  +-------+          +-------+
```

Final frame includes color: green border/text for YES, red for NO.

## Architecture

- Standard plugin following guid pattern
- Single command processor, no sub-commands
- Raw terminal animation via `context.terminal.write()` + ANSI escape codes
- Uses `setInterval` with increasing delays for deceleration
- Handles `context.onAbort` to cleanly cancel animation on Ctrl+C

## Plugin Structure

```
projects/yesno/
  src/
    lib/
      cli-yesno.module.ts
      processors/cli-yesno-command-processor.ts
      index.ts
      version.ts
    public-api.ts
    cli-entrypoint.ts
  package.json
  ng-package.json
  rollup.config.mjs
  tsconfig.*.json
  README.md
```
