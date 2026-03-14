import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig(({ mode }) => ({
  root: resolve(__dirname, "src"),
  publicDir: resolve(__dirname, "public"),
  base: "",
  define: {
    __CLAIRITY_DEV__: mode === "development",
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/index.html"),
        options: resolve(__dirname, "src/options/index.html"),
        "service-worker": resolve(
          __dirname,
          "src/background/service-worker.ts"
        ),
        content: resolve(__dirname, "src/content/index.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
  resolve: {
    alias: {
      shared: resolve(__dirname, "../shared"),
    },
  },
}));
