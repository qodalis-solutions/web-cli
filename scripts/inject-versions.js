const fs = require("fs");
const path = require("path");

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
