# @qodalis/cli-server-jobs

CLI extension for managing server-side background jobs from the [Qodalis CLI](https://qodalis.com/) terminal. Connects to any Qodalis CLI server (`.NET`, `Node.js`, or `Python`) and provides commands to list, trigger, pause, stop, and inspect jobs.

## Installation

```bash
packages add @qodalis/cli-server-jobs
```

## Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `jobs list` | `jobs ls` | List all registered jobs |
| `jobs info <name\|id>` | — | Show job details |
| `jobs trigger <name\|id>` | `jobs run` | Trigger immediate execution |
| `jobs pause <name\|id>` | — | Pause scheduled execution |
| `jobs resume <name\|id>` | — | Resume a paused job |
| `jobs stop <name\|id>` | — | Stop a job |
| `jobs cancel <name\|id>` | — | Cancel current execution |
| `jobs history <name\|id>` | `jobs hist` | Show execution history |
| `jobs logs <name\|id>` | — | Show logs for last execution |
| `jobs edit <name\|id>` | — | Update job options |
| `jobs watch` | — | Watch real-time job events via WebSocket |

## Usage

```bash
jobs list
# Lists all jobs across connected servers with status, schedule, and last run info

jobs list --server dotnet
# List jobs from a specific server only

jobs trigger health-check
# Triggers immediate execution of the health-check job

jobs history health-check
# Shows paginated execution history

jobs logs health-check
# Shows logs from the most recent execution

jobs pause health-check
# Pauses the job's scheduled execution

jobs resume health-check
# Resumes a paused job

jobs edit health-check --maxRetries 3 --overlapPolicy queue
# Updates job configuration

jobs watch
# Streams real-time job events (started, completed, failed, etc.)
```

## Parameters

| Parameter | Description |
|-----------|-------------|
| `--server <name>` | Target a specific connected server |
| `--limit <n>` | Number of history entries to show (default: 20) |
| `--offset <n>` | Pagination offset for history |
| `--status <status>` | Filter history by status (completed, failed, etc.) |

## Programmatic Usage

```typescript
import { jobsModule } from '@qodalis/cli-server-jobs';

// Register in your CLI configuration
const modules = [jobsModule, /* other modules */];
```

## License

MIT
