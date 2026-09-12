#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig, readFlag, repositoryRoot } from "./lib/config.mjs";
import { generateProfileReadme } from "./lib/readme.mjs";

async function loadAnalytics(readmePath) {
  try {
    const analyticsPath = resolve(readmePath, "..", "assets", "analytics", "analytics.json");
    const raw = await readFile(analyticsPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

try {
  const config = await loadConfig(readFlag("--config"));
  const manifestPath = resolve(repositoryRoot, "assets/hero/manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const readmePath = resolve(repositoryRoot, "README.md");
  const analytics = await loadAnalytics(readmePath);
  await generateProfileReadme({ config, manifest, readmePath, analytics });
  console.log("Generated README.md from profile.config.json.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
