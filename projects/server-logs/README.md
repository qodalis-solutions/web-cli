# Cli extension

The `@qodalis/cli-server-logs` package is a CLI extension designed to provide seamless server log management and analysis capabilities for the Qodalis CLI.

# Features

    View Logs: Fetch and display server logs directly in the CLI.
    Filter Logs: Apply filters based on date, severity, or keywords.
    Download Logs: Download logs to a local file for further analysis.
    Integration: Integrates seamlessly with Qodalis CLI for server monitoring.

# Installation

```bash
packages add @qodalis/cli-server-logs
```

This command downloads and registers the extension for use within the CLI environment.

# Usage

```bash
server-logs live
server-logs live --level=error
server-logs live --file # on Ctrl + C the logs are downloaded in a file
server-logs live --pattern=text-to-search # supports regex

server-logs --help # for more options
```

# Dependencies

This extension is dependent on a server which use signalR as a transport layer.
