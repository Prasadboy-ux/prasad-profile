#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig, repositoryRoot } from "./lib/config.mjs";
import {
  fetchProfileOverview,
  fetchAllPublicRepositories,
  fetchCommitCountsForRepositories,
  fetchLanguageDataForRepositories,
  fetchRecentPublicActivity
} from "./lib/repositories.mjs";
import { calculateAllAnalytics } from "./lib/analytics.mjs";

const cachePath = resolve(repositoryRoot, "assets/analytics/cache.json");
const analyticsOutputPath = resolve(repositoryRoot, "assets/analytics/analytics.json");

async function loadCache() {
  try {
    const raw = await readFile(cachePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveCache(data) {
  await mkdir(resolve(repositoryRoot, "assets/analytics"), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function saveAnalytics(data) {
  await mkdir(resolve(repositoryRoot, "assets/analytics"), { recursive: true });
  await writeFile(analyticsOutputPath, `${JSON.stringify(data, null, 2)}\n`);
}

function isCacheValid(cache, username) {
  if (!cache || typeof cache !== "object") return false;
  if (cache.username !== username) return false;
  if (!cache.timestamp || typeof cache.timestamp !== "number") return false;
  if (Date.now() - cache.timestamp > 30 * 60 * 1000) return false;
  if (!cache.repositories || !Array.isArray(cache.repositories)) return false;
  if (!cache.analytics || typeof cache.analytics !== "object") return false;
  return true;
}

async function generateAnalytics() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const config = await loadConfig();
  const username = config.profile.username;

  const cache = await loadCache();
  if (isCacheValid(cache, username)) {
    console.log(`Using cached analytics from ${new Date(cache.timestamp).toISOString()}.`);
    await saveAnalytics(cache.analytics);
    return cache.analytics;
  }

  console.log(`Fetching analytics for ${username}...`);

  const [overview, repositories] = await Promise.all([
    fetchProfileOverview({ token, username }),
    fetchAllPublicRepositories({ token, username })
  ]);

  console.log(`Found ${repositories.length} public repositories.`);

  const [commitsByRepo, languageDataByRepo, recentActivity] = await Promise.all([
    fetchCommitCountsForRepositories({ token, username, repositories }),
    fetchLanguageDataForRepositories({ token, username, repositories }),
    fetchRecentPublicActivity({ token, username, limit: 30 })
  ]);

  const analytics = calculateAllAnalytics({
    repositories,
    overview,
    commitsByRepo,
    languageDataByRepo
  });

  analytics.recentActivity = recentActivity;

  const cacheData = {
    version: "1.0.0",
    username,
    timestamp: Date.now(),
    repositories,
    commitsByRepo,
    languageDataByRepo,
    analytics
  };

  await saveCache(cacheData);
  await saveAnalytics(analytics);

  console.log(`Analytics generated and cached.`);
  console.log(`  Public repositories: ${analytics.profileOverview.publicRepos}`);
  console.log(`  Total stars: ${analytics.profileOverview.totalStars}`);
  console.log(`  Total forks: ${analytics.profileOverview.totalForks}`);
  console.log(`  Total commits: ${analytics.profileOverview.totalCommits}`);
  console.log(`  Followers: ${analytics.profileOverview.followers}`);
  console.log(`  Following: ${analytics.profileOverview.following}`);

  return analytics;
}

try {
  const analytics = await generateAnalytics();
  console.log("Analytics generation complete.");
  process.exitCode = 0;
} catch (error) {
  console.error(`Analytics generation failed: ${error.message}`);
  process.exitCode = 1;
}
