import type { Options } from 'tsup';

export const sharedConfig: Partial<Options> = {
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
};
