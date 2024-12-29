import typescript from 'rollup-plugin-typescript2';

export default {
    input: 'src/cli-entrypoint.ts',
    output: {
        file: '../../dist/guid/umd/index.js',
        format: 'umd',
        name: 'guid',
    },
    plugins: [typescript()],
};
