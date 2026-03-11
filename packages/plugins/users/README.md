# Cli extension

The `@qodalis/cli-users` package is a CLI extension that provides Linux-style user and group management with authentication for the Qodalis CLI. It includes a full user lifecycle, group management, session persistence via IndexedDB, and a permission model based on admin group membership.

# Features

    Full user lifecycle: adduser, userdel, usermod, listusers.
    Group management: groupadd, groupdel, groups.
    Authentication: login, logout, passwd with Web Crypto SHA-256 password hashing.
    Session management: persistent sessions via IndexedDB, su for user switching.
    Identity commands: whoami, id, w/who.
    Permission model: admin group for privileged operations.
    Configurable: seed users, default passwords, session timeout via configure().
    Extensible: swap any service (auth, users store, groups store, session) via DI tokens.

# Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `whoami` | `me` | Show current user |
| `id` | — | Show user identity and groups |
| `adduser` | `useradd` | Create a new user (admin) |
| `userdel` | `deluser` | Delete a user (admin) |
| `usermod` | — | Modify a user account (admin) |
| `passwd` | — | Change user password |
| `su` | `switch-user` | Switch user session |
| `login` | — | Log in with credentials |
| `logout` | `exit-session` | End current session |
| `groups` | — | Show group memberships |
| `groupadd` | `addgroup` | Create a group (admin) |
| `groupdel` | `delgroup` | Delete a group (admin) |
| `w` | `who` | Show session info |
| `listusers` | `users` | List all users |

# Installation

```bash
packages add @qodalis/cli-users
```

This command downloads and registers the extension for use within the CLI environment.

# Usage

```bash
whoami
# root

whoami --info
# Displays detailed user info including email and groups

adduser john --email=john@example.com
# Created user john

passwd
# Change password for current user

su john
# Switch to user john

login
# Log in with username and password

logout
# End current session

groups
# Show groups for current user

groupadd devs --description="Development team"
# Created group devs

usermod john --add-groups=devs
# Added john to group devs

id john
# uid=john gid=devs groups=devs

w
# Show current session info
```

# Configuration

Use `configure()` to customize the module before loading:

```typescript
import { usersModule } from '@qodalis/cli-users';

usersModule.configure({
    seedUsers: [
        { name: 'admin', email: 'admin@company.com', groups: ['admin'] },
    ],
    defaultPassword: 'changeme',
});
```

# Extensibility

You can swap any built-in service by overriding the module's services array:

```typescript
import { usersModule } from '@qodalis/cli-users';

// Server-backed authentication
const customModule = {
    ...usersModule,
    services: [
        ...usersModule.services,
        { provide: 'cli-auth-service', useValue: new MyServerAuthService() },
    ],
};
```

# Default behavior

By default the module seeds a `root` user (root@localhost, admin group, password: `root`) and an `admin` group. On first boot it auto-logs in as root. Sessions persist across page reloads via IndexedDB.
