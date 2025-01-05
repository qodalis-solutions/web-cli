const fs = require("fs/promises");
const path = require("path");
const readline = require("readline");
const { exec } = require("child_process");

const { runCommand } = require("./shared");

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function clearDirectory(directory) {
  try {
    // Check if the directory exists
    await fs.access(directory);

    // Read the directory contents
    const files = await fs.readdir(directory);

    // Delete each file
    for (const file of files) {
      const filePath = path.join(directory, file);
      await fs.unlink(filePath);
      console.log(`Deleted file: ${filePath}`);
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(`Directory "${directory}" does not exist.`);
    } else {
      console.error(`Failed to clear directory "${directory}":`, err);
    }
  }
}

async function replaceFileContent(filePath, newContent) {
  try {
    // Write new content to the file
    await fs.writeFile(filePath, newContent, "utf8");
    console.log(`File content replaced successfully at: ${filePath}`);
  } catch (err) {
    console.error(
      `Failed to replace file content at ${filePath}:`,
      err.message,
    );
  }
}

async function getFileContent(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content;
  } catch (err) {
    console.error(`Failed to read file at ${filePath}:`, err.message);
    throw err; // Re-throw the error for handling by the caller
  }
}

async function createFile(filePath, content = "") {
  try {
    // Ensure the directory exists
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true });

    // Write the file
    await fs.writeFile(filePath, content, "utf8");
    console.log(`File created successfully at: ${filePath}`);
  } catch (err) {
    console.error(`Failed to create file at ${filePath}:`, err.message);
    throw err; // Re-throw the error for handling by the caller
  }
}

async function getTemplate(templateName) {
  return await getFileContent(`./scripts/templates/${templateName}`);
}

async function getTemplateWithVars(templateName, data) {
  const template = await getFileContent(`./scripts/templates/${templateName}`);

  if (!template) {
    throw new Error(`Template not found: ${templateName}`);
  }

  return replace(template, data);
}

function replace(text, data) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return key in data ? data[key] : `{{${key}}}`;
  });
}

async function main() {
  const name = await prompt("Enter library name: ");

  if (!name) {
    console.error("Library name is required");
    return;
  }

  console.log(`Creating ${name} library...`);

  await runCommand(exec, `ng generate library ${name}`, process.cwd());

  const projectDirectory = "./projects/" + name;

  await clearDirectory(projectDirectory + "/src/lib");

  const version = "0.0.1";

  const vars = {
    name,
    version,
    description: "Provide utility functions for the library " + name,
  };

  const packageJson = await getTemplateWithVars("package.json", vars);
  await replaceFileContent(projectDirectory + "/package.json", packageJson);

  const ngPackage = await getTemplateWithVars("ng-package.json", vars);
  await replaceFileContent(projectDirectory + "/ng-package.json", ngPackage);

  const readme = await getTemplateWithVars("README.md", vars);
  await replaceFileContent(projectDirectory + "/README.md", readme);

  await createFile(
    projectDirectory + "/src/lib/version.ts",
    `
// Automatically generated during build
export const LIBRARY_VERSION = '${version}';
    `,
  );

  const processorName = await prompt(
    "Enter processor name Cli{{name}}CommandProcessor: ",
  );

  if (!processorName) {
    console.error("Processor name is required");
    return;
  }

  vars.processorName = processorName;

  const cliEntryPoint = await getTemplateWithVars("cli-entrypoint.txt", vars);
  await createFile(projectDirectory + "/src/cli-entrypoint.ts", cliEntryPoint);

  const rollupConfig = await getTemplateWithVars("rollup.config.mjs", vars);
  await createFile(projectDirectory + "/rollup.config.mjs", rollupConfig);

  const publicApi = await getTemplateWithVars("public-api.txt", vars);
  await createFile(projectDirectory + "/src/public-api.ts", publicApi);

  const processorFileName = `cli-${name}-command-processor`;
  vars.processorFileName = processorFileName;

  const processorTemplate = await getTemplateWithVars("processor.txt", vars);

  await createFile(
    projectDirectory + `/src/lib/processors/${processorFileName}.ts`,
    processorTemplate,
  );

  const moduleTemplate = await getTemplateWithVars("module.txt", vars);

  await createFile(
    projectDirectory + `/src/lib/cli-${name}.module.ts`,
    moduleTemplate,
  );

  const testTemplate = await getTemplateWithVars("tests.txt", vars);
  await createFile(projectDirectory + `/src/tests/index.spec.ts`, testTemplate);

  const tsConfig = await getFileContent("./tsconfig.json");
  await replaceFileContent(
    "./tsconfig.json",
    tsConfig.replace(name, "@qodalis/cli-" + name),
  );

  await runCommand(exec, `ng build ${name}`, process.cwd());
}

main();
