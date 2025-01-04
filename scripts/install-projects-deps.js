#!/usr/bin/env node

const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { runCommand } = require("./shared");

// Root folder containing subfolders
const projectsFolder = path.resolve(__dirname, "../projects");

async function installDeps() {
  try {
    // Read all subfolders
    const entries = fs.readdirSync(projectsFolder, { withFileTypes: true });

    const subfolders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    if (subfolders.length === 0) {
      console.log("No subfolders found.");
      return;
    }

    console.log(
      `Found ${subfolders.length} subfolders. Starting install process.`,
    );

    for (const folder of subfolders) {
      const folderPath = path.join(projectsFolder, folder);

      await runCommand(
        exec,
        `cd ${folderPath} && npm i || echo 'Skip install'`,
        folderPath,
      );
    }

    console.log("All projects deps installed successfully.");
  } catch (error) {
    console.error("Error during the build process:", error);
    process.exit(1);
  }
}

// Start the process
installDeps();
