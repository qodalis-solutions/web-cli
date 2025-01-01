import { baseConfig, buildLibraryOutputConfig } from "../../rollup.shared.mjs";

export default {
  ...baseConfig,
  input: "src/cli-entrypoint.ts",
  output: {
    ...buildLibraryOutputConfig("speed-test"),
  },
};
