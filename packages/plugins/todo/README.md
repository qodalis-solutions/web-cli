# @qodalis/cli-todo

A practical CLI task manager. Add, list, edit, complete, and remove tasks with due dates.

## Installation

```
packages add @qodalis/cli-todo
packages add todo
```

## Commands

```bash
# Add tasks
todo add Buy groceries
todo add Submit report --due tomorrow
todo add Call dentist --due friday
todo add Pay rent --due 2026-03-15

# List tasks
todo ls                    # all tasks with progress
todo ls --pending          # pending only
todo ls --completed        # completed only
todo ls --overdue          # overdue only

# Edit tasks
todo edit 3 Buy organic groceries
todo edit 3 --due next week
todo edit 3 New text --due monday
todo edit 3 --due none     # remove due date

# Complete tasks
todo done 1                # mark as done
todo toggle 2              # toggle done/undone

# Remove tasks
todo rm 3                  # remove by ID
todo rm --all              # remove all (with confirmation)
```

## Due Date Formats

| Format | Example |
|--------|---------|
| `today` | Due today |
| `tomorrow` | Due tomorrow |
| Day name | `monday`, `friday` (next occurrence) |
| `next week` | 7 days from now |
| `next month` | 1 month from now |
| `YYYY-MM-DD` | `2026-03-15` |

## Display

```
Todos (2/5 done)
  [ ] #1 - Buy groceries            due: tomorrow
  [x] #2 - Finish report            done
  [ ] #3 - Call dentist              overdue: 2 days ago
  [x] #4 - Send email               done
  [ ] #5 - Clean kitchen
```

Overdue tasks are highlighted in red. Completed tasks show strikethrough text.
