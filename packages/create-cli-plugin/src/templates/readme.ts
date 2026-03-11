import { TemplateVars } from './types';

export function readmeTemplate(vars: TemplateVars): string {
    const fence = '`'.repeat(3);
    return `# @qodalis/cli-${vars.name}

${vars.description}

## Installation

${fence}bash
packages add @qodalis/cli-${vars.name}
${fence}

## Usage

${fence}bash
${vars.name}
${fence}

## Development

${fence}bash
npm install
npm run build
${fence}

## Build

Builds two outputs:
- **Module** (CJS + ESM): \`dist/public-api.js\` and \`dist/public-api.mjs\`
- **IIFE bundle**: \`dist/umd/index.js\` (for browser runtime loading)
`;
}
