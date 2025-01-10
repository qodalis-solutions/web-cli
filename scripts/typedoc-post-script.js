const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = "docs";
const CNAME_FILE = "CNAME";
const CNAME_LOCATION = "assets/github/" + CNAME_FILE;

fs.copyFileSync(CNAME_LOCATION, path.join(OUTPUT_DIR, CNAME_FILE));
console.log("CNAME file restored.");
