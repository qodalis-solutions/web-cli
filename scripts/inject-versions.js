const fs = require("fs");
const path = require("path");

function updateLibrariesVersions() {
  // Path to the libraries folder in your Angular workspace
  const librariesPath = path.resolve(__dirname, "../projects");

  // Get all library directories
  const libraryDirs = fs.readdirSync(librariesPath).filter((dir) => {
    const packageJsonPath = path.join(librariesPath, dir, "package.json");
    return fs.existsSync(packageJsonPath);
  });

  libraryDirs.forEach((lib) => {
    const packageJsonPath = path.join(librariesPath, lib, "package.json");
    const versionFilePath = path.join(
      librariesPath,
      lib,
      "src",
      "lib",
      "version.ts",
    );

    const packageJson = require(packageJsonPath);
    const version = packageJson.version;

    const versionFileContent = `
// Automatically generated during build
export const LIBRARY_VERSION = '${version}';
  `;

    fs.writeFileSync(versionFilePath, versionFileContent, { encoding: "utf8" });
    console.log(`Version ${version} written to ${versionFilePath}`);
  });
}

function updateWorkspaceVersion() {
  // Specify the workspace package.json path
  const workspacePackageJsonPath = path.resolve(__dirname, "../package.json");

  // Specify the project's package.json path
  const projectPackageJsonPath = path.resolve(
    __dirname,
    "../projects",
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
