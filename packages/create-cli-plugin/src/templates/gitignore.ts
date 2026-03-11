export function gitignoreTemplate(): string {
    return `node_modules/
dist/
*.js
*.mjs
*.d.ts
*.d.mts
*.map
!tsup.config.ts
`;
}
