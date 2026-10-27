export function pnpmWorkspaceTemplate(): string {
    return `# pnpm runs dependency build scripts only when they are allowed; tsup needs esbuild's.
allowBuilds:
  esbuild: true
onlyBuiltDependencies:
  - esbuild
`;
}
