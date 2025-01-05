#!/usr/bin/env node

const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

function runCommand(command, folder) {
  return new Promise((resolve, reject) => {
    console.log(`Running command: "${command}" in folder: ${folder}`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error in folder ${folder}:`, error.message);
        return reject(error);
      }
      if (stdout) console.log(`Output from ${folder}:\n${stdout}`);
      if (stderr) console.error(`Error output from ${folder}:\n${stderr}`);
      resolve();
    });
  });
}

// Root folder containing subfolders
const projectsFolder = path.resolve(__dirname, "../projects");

async function installDeps() {
  try {
    // Read all subfolders
    const entries = fs.readdirSync(projectsFolder, { withFileTypes: true });

    const excludedFolders = ["cli"];

    const subfolders = entries
      .filter((entry) => entry.isDirectory())
      .filter(
        (entry) => entry.isDirectory() && !excludedFolders.includes(entry.name),
      )
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
