#!/usr/bin/env node

const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { runCommand } = require("./shared");

// Root folder containing subfolders
const rootFolder = path.resolve(__dirname, "../");
const projectsFolder = path.resolve(__dirname, "../projects");

// Main function to process folders sequentially
async function buildProjects() {
  try {
    // Read all subfolders
    const entries = fs.readdirSync(projectsFolder, { withFileTypes: true });
    const mainFolders = ["core", "cli"];

    // Filter and sort directories
    const subfolders = mainFolders
      .concat(
        entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .filter((entry) => !mainFolders.includes(entry) && entry !== "demo"),
      )
      .concat(["demo"]);

    if (subfolders.length === 0) {
      console.log("No subfolders found.");
      return;
    }

    console.log(
      `Found ${subfolders.length} subfolders. Starting build process.`,
    );

    // Sequentially execute the build command for each folder
    for (const folder of subfolders) {
      const folderPath = path.join(projectsFolder, folder);

      await runCommand(
        exec,
        `cd ${rootFolder} && ng build ${folder}`,
        folderPath,
      );
    }

    for (const folder of subfolders) {
      const folderPath = path.join(projectsFolder, folder);

      if (fs.existsSync(path.join(folderPath, "rollup.config.mjs"))) {
        console.log(`Running rollup for ${folder}`);
        const rollupCommand = `cd ${folderPath} && npx rollup -c`;
        await runCommand(exec, rollupCommand, folderPath);
      }
    }

    console.log("All projects built successfully.");
  } catch (error) {
    console.error("Error during the build process:", error);
    process.exit(1);
  }
}

// Start the process
buildProjects();
