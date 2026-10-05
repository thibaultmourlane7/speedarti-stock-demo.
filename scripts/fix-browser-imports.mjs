import { promises as fs } from "node:fs";

const root = new URL("../browser-dist/", import.meta.url);

async function walk(url) {
  const entries = await fs.readdir(url, { withFileTypes: true });
  for (const entry of entries) {
    const target = new URL(entry.name + (entry.isDirectory() ? "/" : ""), url);
    if (entry.isDirectory()) {
      await walk(target);
      continue;
    }
    if (!entry.name.endsWith(".js")) continue;
    let content = await fs.readFile(target, "utf8");
    content = content
      .replace(/(from\s+["'])(\.{1,2}\/[^"']+)(["'])/g, (all, start, spec, end) =>
        /\.[a-z0-9]+$/i.test(spec) ? all : `${start}${spec}.js${end}`)
      .replace(/(import\s*\(\s*["'])(\.{1,2}\/[^"']+)(["']\s*\))/g, (all, start, spec, end) =>
        /\.[a-z0-9]+$/i.test(spec) ? all : `${start}${spec}.js${end}`);
    await fs.writeFile(target, content);
  }
}

await walk(root);
