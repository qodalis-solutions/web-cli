# Jobs: max concurrent runs, and no job started twice

Date: 2026-11-06. Applies to the jobs plugins of cli-server-dotnet, cli-server-node and cli-server-python
(1.0.0-beta.23), the dashboard (1.0.0-beta.18) and web-cli's `server jobs` (2.4.0).

## Problem

Jobs start twice. Seen in RateBell: every job that runs on start ran twice when the worker was started twice
18 s apart. The deploy is fixed, but the scheduler itself allows duplicates:

1. **Run on start ignores the last run.** Every start of the process runs every `RunOnStart` job again, even
   when it ran seconds ago (a restart, a crash loop or a double deploy hammers every source).
2. **Retries free the job.** Between a failed attempt and its retry (the retry delay) the job counts as not
   running, so a timer tick or a trigger starts a second run while the retry is still to come.
3. **Queue does not queue.** `OverlapPolicy.Queue` starts the new run at once, in parallel; the two runs
   overwrite each other's "current execution", so a third can start too.
4. **Check-then-start races.** Timer callbacks and triggers check "is it running" and start a run without a
   lock: two at the same moment both start.
5. **Cron fires early.** Timers may fire a few milliseconds early; the next occurrence computed from "now" is
   then the same occurrence, which runs again.
6. **Interrupted runs stay "running".** A run cut off by a restart is never finished in the store; it shows as
   running forever (and as overlapping every later run).

## New option: `maxConcurrentRuns`

Per job, integer >= 1, default **1** (today's behaviour). Up to N runs of the job at the same time.

- A **run** holds its slot from its start until it ends, **including its retries and the delays between them**.
- When a run is due (timer, manual trigger, run on start) and N runs are going, the overlap policy decides:
  - `skip`: the due run is dropped. A manual trigger is refused (409 `JOB_ALREADY_RUNNING`, as today).
  - `queue`: one run is queued and starts when a slot frees. Queued runs **coalesce**: at most one is pending per
    job (several due runs while full make one more run, not a backlog). A manual trigger is accepted (202/200)
    and queued.
  - `cancel`: the **oldest** running run is cancelled and the new one starts.
- Taking a slot is atomic (a lock per job or per scheduler): two due runs at the same moment never exceed N.
- Lowering `maxConcurrentRuns` below the running count cancels nothing: runs finish, and new runs start only once
  the count is below the limit.

Job info (`GET /jobs`, `GET /jobs/{id}`, MCP, `ICliJobManager` `CliJobInfo`):

- `maxConcurrentRuns` (number).
- `runningExecutionIds` (array, oldest first; empty when idle).
- `currentExecutionId` stays: the newest running run, or null.
- `queued` (boolean): a queued run is waiting.

Changing it: `PUT /jobs/{id}` accepts `maxConcurrentRuns` (integer >= 1; anything else is 400 like other invalid
values), as do the code options (`CliJobOptions.MaxConcurrentRuns` / `maxConcurrentRuns` / `max_concurrent_runs`)
and every update path the server already has (MCP update tool if there is one, server commands).

`cancel` (cancel the current run) cancels **every** running run of the job and drops a queued one. `stop` does the
same and disables the schedule (as today).

## Run on start

`RunOnStart` means "run when the server starts unless the job ran recently":

- Interval job: run on start only when it never ran (no saved last run) or its next run is due
  (`lastRunAt + interval <= now`). Otherwise the timer keeps the rhythm from the last run.
- Cron job: run on start only when it never ran or missed an occurrence (an occurrence between the last run and
  now).
- A job without a schedule (manual only) with `RunOnStart`: runs on every start (nothing to compare against).
- The run on start goes through the same slot logic as any due run.

## Cron

Compute the next occurrence from the occurrence that just fired (exclusive), not from the current time; if that
is already past (the process was busy or the clock jumped), use the next occurrence after now. A tick that fires
early never runs the same occurrence twice.

## Interrupted runs

When the scheduler starts, runs of its registered jobs that the store still has as `running` (left by a previous
process) are finished as `cancelled` with the error `Interrupted: the server stopped during the run` and a
completion time (their start time when unknown, so durations stay sane). Only the scheduler's own store is
touched, and only at start. No events are published for them (no client is connected yet).

## Events

Unchanged types; `job:started` and the finished events keep their fields. `job:updated` covers a change of
`maxConcurrentRuns`. A run that is queued publishes nothing until it starts. A due run dropped by `skip`
publishes nothing (as today).

## Consumers

- Dashboard: the job edit dialog has "Max concurrent runs" (number, min 1); job detail shows it next to the
  overlap policy and shows "N running" when more than one run is going, and "queued" when a run waits. The jobs
  list status column shows the running count when > 1.
- web-cli `server jobs`: `info` shows max concurrent runs, the running runs and queued; `edit` asks for it;
  `set`/flags if the command has non-interactive options.
- Custom `ICliJobManager` implementations (RateBell's) map the new fields; a manager that does not support the
  option reports `maxConcurrentRuns: 1`.

## Tests (every server)

- N = 1 and N = 2: concurrent due runs (timer ticks and triggers fired in parallel) never exceed N.
- A retry delay keeps the slot: a tick during the delay does not start a run (skip) / queues one (queue).
- Queue coalesces: three due runs while full make exactly one extra run.
- Cancel cancels the oldest run.
- Run on start: not run when the last run is recent; run when due or never ran; cron missed occurrence.
- Cron: a tick that fires early does not run the occurrence twice.
- Interrupted runs are finished as cancelled on start.
- API: `maxConcurrentRuns` in job info, update validation, `runningExecutionIds`, `queued`.
