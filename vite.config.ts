import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

async function listBuildFiles(directory: string, root = directory): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return listBuildFiles(path, root);
      return [`/${relative(root, path).split(sep).join("/")}`];
    }),
  );

  return files.flat();
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "courtlab-pwa-assets",
      apply: "build",
      async closeBundle() {
        const outputDirectory = join(process.cwd(), "dist");
        const version = Date.now().toString();
        const serviceWorkerPath = join(outputDirectory, "sw.js");
        const serviceWorker = await readFile(serviceWorkerPath, "utf8");
        await writeFile(
          serviceWorkerPath,
          serviceWorker.replace("__COURTLAB_BUILD_VERSION__", version),
        );

        const excluded = new Set(["/pwa-assets.json"]);
        const assets = (await listBuildFiles(outputDirectory))
          .filter((file) => !excluded.has(file))
          .sort();

        await writeFile(
          join(outputDirectory, "pwa-assets.json"),
          `${JSON.stringify({ version, assets }, null, 2)}\n`,
        );
      },
    },
  ],
  test: {
    environment: "jsdom",
  },
});
