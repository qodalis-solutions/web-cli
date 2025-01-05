# Cli extension

The `@qodalis/cli-todo` package is a powerful CLI extension designed to help you manage your tasks efficiently. With a simple and intuitive command structure, you can add, list, complete, and remove TODO items directly from your command line.

# Features

    Add tasks with a single command.
    View all your TODO items in a clear, organized list.
    Mark tasks as complete to keep track of your progress.
    Remove tasks when they are no longer needed.
    Persistent storage for your tasks across CLI sessions.

# Installation

```bash
packages add @qodalis/cli-todo
```

This command downloads and registers the extension for use within the CLI environment.

# Usage

```bash
todo ls
todo add <task description>
todo add Buy groceries
todo add Finish the project report
todo complete <task ID>
todo complete 1
todo rm <task ID>

todo ls
[ ] #2 - Finish the project report
```
