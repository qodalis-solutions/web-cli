# Qodalis Angular CLI

**Qodalis Angular CLI** is a web-based terminal CLI component for Angular applications. It provides a powerful and extensible interface to execute commands and streamline workflows directly within your web application. The CLI can be extended with custom command processors to suit your specific needs.

---

## Features

- **Web-Based Terminal**: A terminal interface integrated into your Angular applications.
- **Custom Command Processors**: Easily extend functionality by creating custom command processors.
- **Lightweight and Flexible**: Designed to work seamlessly with your existing Angular project.
- **Interactive Interface**: Enables command execution and response handling in a terminal-like UI.

---

## Installation

Install the package using npm:

```bash
npm install @qodalis/angular-cli
```

## Usage

![Install packages](docs/assets/help_command.gif)

After installing, you can integrate the CLI component into your Angular application:

## Basic Setup

1. Import the CLI Module:

```typescript
import { CliModule } from "@qodalis/angular-cli";

@NgModule({
  imports: [CliModule, Cli***Module],
})
export class AppModule {}
```

2. Set the styles in the **angular.json**

```json
{
  "projects": {
    "your-project": {
      "architect": {
        //...
        "options": {
          //...
          "styles": [
            //styles
            "node_modules/@qodalis/angular-cli/src/assets/styles.sass"
          ]
        }
      }
    }
  }
}
```

3. Add the CLI Component to Your Template:

```html
<!-- 
    Show a terminal
 -->
<app-cli [options]="cliOptions" />

<!-- 
    Show a terminal wrapped in a container that is located at the bottom of the page and can be collapsed/expanded
 -->
<app-cli-panel />
```

4. Configure the CLI:

```typescript
cliOptions = {
  welcomeMessage: "-- your custom welcome message --",
  //TODO: supports multiple customizations
};
```

## Example Commands

### Built-in Commands

- **help**: Displays available commands and their descriptions.
- **clear**: Clears the terminal screen.
- **echo \<message\>**: Prints the provided message to the terminal.
- **ping**: Pings the server
- **theme**: Interact with the cli theme
- **history**: Prints the command history of the current session
- **su**: Switch user
- **version**: Prints the version information
- **whoami**: Display current user information
- **eval**: Evaluate a JavaScript expression
- **packages**: Manage packages in the cli

## Cli Packages

- Add JavaScript packages dynamically.
- Evaluate JavaScript expressions using added packages.
- Display results in a structured format.

### Usage

![Install packages](docs/assets/install_packages.gif)

### Add a Package

To add a package, use the packages add command:

```bash
root:~$ packages add <package-name>
```

Example:

```bash
root:~$ packages add lodash
```

This command downloads and makes the package available for evaluation.

### Remove a Package

Remove a package using the `packages remove` command:

```bash
root:~$ packages remove lodash
```

### Example

```bash
root:~$ packages add lodash
root:~$ eval _.map([1, 2, 3, 4, 5], (n) => n * 2);
Output:
[
  2,
  4,
  6,
  8,
  10
]
root:~$
```

## Available packages

- [@qodalis/cli-guid](https://www.npmjs.com/package/@qodalis/cli-guid) - utility for guid
- [@qodalis/cli-server-logs](https://www.npmjs.com/package/@qodalis/cli-server-logs) - utility for live server logs
- [@qodalis/cli-text-to-image](https://www.npmjs.com/package/@qodalis/cli-text-to-image) - utility to generate images from text
- [@qodalis/cli-regex](https://www.npmjs.com/package/@qodalis/cli-regex) - provide utilities for working with regular expressions
- [@qodalis/cli-speed-test](https://www.npmjs.com/package/@qodalis/cli-speed-test) - run the internet speed test
- [@qodalis/cli-browser-storage](https://www.npmjs.com/package/@qodalis/cli-browser-storage) - provide commands to operate with browser storage like cookie, localStorage etc.
- More will be implemented ...

## Extending with Custom Commands

You can extend the CLI by creating a class that implements the ICliCommandProcessor interface. This allows you to define new commands and their behavior.

### Creating a Custom Command Processor

1. Create a new class that extends `ICliCommandProcessor`:

```typescript
import { ICliCommandProcessor, CliProcessCommand, ICliExecutionContext } from "@qodalis/angular-cli";

export class MyCustomCommandProcessor implements ICliCommandProcessor {
  command = "greet";
  description = "Greet the user with a custom message";
  allowUnlistedCommands = true;

  async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
    const name = command.value;
    const message = name ? `Hello, ${name}!` : "Hello!";
    context.writer.writeln(message);
  }
}
```

2. Register the command processor:

```typescript
import { CliModule, resolveCommandProcessorProvider } from "@qodalis/angular-cli";

@NgModule({
  imports: [CliModule],
  providers: [resolveCommandProcessorProvider(MyCustomCommandProcessor)],
})
export class AppModule {}
```

### Custom Command Example

After registering **MyCustomCommandProcessor**, you can use the following command:

```bash
greet John
```

Output:

```bash
Hello, John!
```

## Live Example

Check out a live example of the Qodalis Angular CLI on StackBlitz: [Live Example on StackBlitz](https://stackblitz.com/~/github.com/qodalis-nicolae-lupei/stackblitz-qodalis-cli-example)

## Contributing

We welcome contributions! To contribute:

1. Fork this repository.
2. Create a branch for your feature or bugfix.
3. Submit a pull request.

Please ensure all contributions follow the project coding standards.

## License

This project is licensed under the MIT License. See the **LICENSE** file for details.

```vbnet

You can copy this content into a file named `README.md` in your project directory. Let me know if there's anything else you'd like to adjust! 🚀
```
