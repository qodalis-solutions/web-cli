const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = "docs";
const CNAME_FILE = "CNAME";

fs.copyFileSync(CNAME_FILE, path.join(OUTPUT_DIR, CNAME_FILE));
console.log("CNAME file restored.");
