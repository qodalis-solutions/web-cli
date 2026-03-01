const fs = require("fs");
const path = require("path");

function updateLibrariesVersions() {
  const packagesPath = path.resolve(__dirname, "../packages");
  const pluginsPath = path.resolve(__dirname, "../packages/plugins");

  // Get top-level packages (excluding 'plugins' directory)
  const topLevelDirs = fs.readdirSync(packagesPath).filter((dir) => {
    const fullPath = path.join(packagesPath, dir);
    return (
      fs.statSync(fullPath).isDirectory() &&
      dir !== "plugins" &&
      fs.existsSync(path.join(fullPath, "package.json"))
    );
  });

  // Get plugin packages
  const pluginDirs = fs.existsSync(pluginsPath)
    ? fs.readdirSync(pluginsPath).filter((dir) => {
        const fullPath = path.join(pluginsPath, dir);
        return (
          fs.statSync(fullPath).isDirectory() &&
          fs.existsSync(path.join(fullPath, "package.json"))
        );
      })
    : [];

  // Helper to write version file for a package
  function writeVersionFile(packageDir, lib) {
    const packageJsonPath = path.join(packageDir, "package.json");
    const versionFilePath = path.join(packageDir, "src", "lib", "version.ts");

    const packageJson = require(packageJsonPath);
    const version = packageJson.version;

    const versionFileContent = `
// Automatically generated during build
export const LIBRARY_VERSION = '${version}';
export const API_VERSION = 2;
  `;

    // Skip projects that don't use the src/lib/version.ts pattern (e.g. react-cli, vue-cli)
    const versionDir = path.dirname(versionFilePath);
    if (!fs.existsSync(versionDir)) {
      console.log(`Skipping ${lib} (no src/lib/ directory)`);
      return;
    }

    fs.writeFileSync(versionFilePath, versionFileContent, {
      encoding: "utf8",
    });
    console.log(`Version ${version} written to ${versionFilePath}`);
  }

  // Process top-level packages
  topLevelDirs.forEach((lib) => {
    writeVersionFile(path.join(packagesPath, lib), lib);
  });

  // Process plugin packages
  pluginDirs.forEach((lib) => {
    writeVersionFile(path.join(pluginsPath, lib), `plugins/${lib}`);
  });
}

function updateWorkspaceVersion() {
  // Specify the workspace package.json path
  const workspacePackageJsonPath = path.resolve(__dirname, "../package.json");

  // Specify the project's package.json path (cli is the canonical version source)
  const projectPackageJsonPath = path.resolve(
    __dirname,
    "../packages",
    "cli",
    "package.json",
  );

  try {
    // Read and parse the workspace package.json
    const workspacePackageJson = JSON.parse(
      fs.readFileSync(workspacePackageJsonPath, "utf-8"),
    );

    // Read and parse the project's package.json
    const projectPackageJson = JSON.parse(
      fs.readFileSync(projectPackageJsonPath, "utf-8"),
    );

    // Get the version from the project's package.json
    const projectVersion = projectPackageJson.version;

    if (!projectVersion) {
      throw new Error(
        "The specific project package.json does not have a version field.",
      );
    }

    // Update the version in the workspace package.json
    workspacePackageJson.version = projectVersion;

    // Write the updated workspace package.json back to file
    fs.writeFileSync(
      workspacePackageJsonPath,
      JSON.stringify(workspacePackageJson, null, 2) + "\n",
      "utf-8",
    );

    console.log(`Workspace package.json version updated to ${projectVersion}`);
  } catch (error) {
    console.error("Error updating package.json version:", error.message);
  }
}

updateLibrariesVersions();
updateWorkspaceVersion();
