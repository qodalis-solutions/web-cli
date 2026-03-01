# File Transfer Plugins Design

## Overview

Two new browser-side plugins (`@qodalis/cli-scp`, `@qodalis/cli-wget`) plus server-side filesystem API endpoints across all three servers (.NET, Node.js, Python) to enable SCP-like file transfer in the web CLI.

## Architecture

### File Abstraction Layer (in `@qodalis/cli-core`)

New `ICliFileTransferService` interface with a default browser-based implementation:

```typescript
interface ICliFileTransferService {
    readFile(path: string): Promise<string | null>;
    writeFile(path: string, content: string): Promise<void>;
    listFiles(path: string): Promise<FileEntry[]>;
    exists(path: string): Promise<boolean>;
    downloadToBrowser(filename: string, content: string | Blob): void;
    uploadFromBrowser(): Promise<{ name: string; content: string } | null>;
}
```

**Default implementation (`BrowserFileTransferService`):**
- `readFile()` -> browser file picker
- `writeFile()` -> browser "Save As" download
- `listFiles()` -> returns empty
- `exists()` -> returns false
- `downloadToBrowser()` -> blob URL + click (always available)
- `uploadFromBrowser()` -> `<input type="file">` dialog (always available)

### Files Plugin Override (in `@qodalis/cli-files`)

Overrides the service token with virtual FS implementation:
- `readFile/writeFile/listFiles/exists` -> IndexedDB virtual FS
- `downloadToBrowser/uploadFromBrowser` -> same browser-native behavior (always works)

### Result

| Scenario | readFile/writeFile | downloadToBrowser/uploadFromBrowser |
|---|---|---|
| No files plugin | Browser dialogs | Browser dialogs |
| Files plugin loaded | Virtual FS (IndexedDB) | Browser dialogs (always native) |

## Plugin 1: `@qodalis/cli-scp`

### Commands

```
# Transfer files
scp download <server> <remote-path> [local-path]
scp upload <server> <local-path> <remote-path>

# Remote file management
scp ls <server> <remote-path>
scp cat <server> <remote-path>
scp rm <server> <remote-path>
scp mkdir <server> <remote-path>
scp stat <server> <remote-path>

# Shorthand
scp <server>:<remote-path> [local-path]       # download
scp <local-path> <server>:<remote-path>        # upload
```

### Structure

```
packages/plugins/scp/
  src/lib/
    processors/
      cli-scp-command-processor.ts       # main 'scp' command + shorthand parsing
      cli-scp-download-processor.ts      # scp download
      cli-scp-upload-processor.ts        # scp upload
      cli-scp-ls-processor.ts            # scp ls
      cli-scp-cat-processor.ts           # scp cat
      cli-scp-rm-processor.ts            # scp rm
      cli-scp-mkdir-processor.ts         # scp mkdir
      cli-scp-stat-processor.ts          # scp stat
    services/
      scp-transfer.service.ts            # HTTP calls to /api/cli/fs/* endpoints
    interfaces/
      index.ts                           # service tokens, types
```

### Dependencies

- `@qodalis/cli-core` only (uses `ICliFileTransferService` abstraction)

### Server Resolution

`<server>` is resolved from `context.options.servers` by name. If only one server is configured, it's the default.

## Plugin 2: `@qodalis/cli-wget`

### Commands

```
wget <url> [local-path]
wget <url> -o output-name.txt
wget <url> --header "Authorization: Bearer token"
wget <url> --no-progress
```

### Structure

```
packages/plugins/wget/
  src/lib/
    processors/
      cli-wget-command-processor.ts      # 'wget <url>' command
    services/
      wget-download.service.ts           # fetch() with progress tracking
```

### Dependencies

- `@qodalis/cli-core` only (uses `ICliFileTransferService` abstraction)

### Behavior

- Uses `fetch()` to download from any URL
- Reads `Content-Length` for progress bar, falls back to spinner if missing
- Streams via `response.body.getReader()` for chunked progress
- Supports `--header` for custom headers, `-o` for output filename
- Saves via `ICliFileTransferService.writeFile()` or `downloadToBrowser()` with `--save` flag

## Server-Side: File System API

All three servers (.NET, Node.js, Python) implement the same REST endpoints:

### Endpoints

```
GET    /api/cli/fs/ls?path=<path>        -> { entries: [{ name, type, size, modified, permissions }] }
GET    /api/cli/fs/cat?path=<path>       -> { content: "..." }
GET    /api/cli/fs/stat?path=<path>      -> { name, type, size, modified, created, permissions }
GET    /api/cli/fs/download?path=<path>  -> binary stream (Content-Disposition: attachment)

POST   /api/cli/fs/upload                -> multipart/form-data { path, file }
POST   /api/cli/fs/mkdir                 -> { path: "/new/dir" }
DELETE /api/cli/fs/rm?path=<path>        -> { success: true }
```

### Per-Server Configuration

| Server | Registration | Config |
|---|---|---|
| .NET | `cli.AddFileSystem(o => ...)` | `o.AllowedPaths = ["/var/data"]` |
| Node.js | `builder.addFileSystem({ ... })` | `allowedPaths: ["/var/data"]` |
| Python | `CliServerOptions(filesystem=...)` | `allowed_paths=["/var/data"]` |

### Security

- `AllowedPaths` whitelist — defaults to empty (nothing accessible until configured)
- Path traversal (`../`) blocked and validated
- Symlink resolution checked against allowed paths

## Error Handling

- **Network errors**: Clear message with server name, suggest checking config
- **403/404**: Show HTTP status + path, explain allowed paths restriction
- **Unknown server**: List available servers from `context.options.servers`
- **No servers configured**: Explain how to add servers
- **Server missing fs endpoints**: "Server does not support file system operations. Update your server package."
- **Large/binary files**: Store as base64 in virtual FS, warn about size overhead
- **No Content-Length**: Spinner instead of progress bar, show bytes transferred
- **Abort (Ctrl+C)**: Cancel in-flight fetch via AbortController, clean up partial files
- **File conflicts**: Overwrite by default, `--no-clobber` flag to skip

## Data Flow

### SCP Download
```
scp download myserver /var/log/app.log ./logs/
  -> resolve server URL from context.options.servers
  -> fetch(serverUrl/api/cli/fs/download?path=/var/log/app.log)
  -> progressBar tracks Content-Length vs bytes
  -> ICliFileTransferService.writeFile("./logs/app.log", content)
```

### SCP Upload
```
scp upload myserver ./config.json /etc/app/
  -> ICliFileTransferService.readFile("./config.json")
  -> fetch(serverUrl/api/cli/fs/upload, { body: FormData })
  -> progressBar shows upload progress
```

### wget
```
wget https://example.com/data.csv
  -> fetch(url) with optional headers
  -> stream response.body.getReader() for progress
  -> ICliFileTransferService.writeFile("data.csv", content)
```
