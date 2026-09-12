#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig, repositoryRoot } from "./lib/config.mjs";
import { createGitHubClient } from "./lib/github-api.mjs";
import { ACTIVITY_END, ACTIVITY_START } from "./lib/readme.mjs";

const dryRun = process.argv.includes("--dry-run");
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function eventToLine(event) {
  const repo = event.repo?.name;
  if (!repo) return null;
  const date = formatDate(event.created_at);
  const repoLink = `https://github.com/${repo}`;

  if (event.type === "PushEvent") {
    const commits = event.payload?.commits?.length || 1;
    return `- ${date}: pushed ${commits} ${commits === 1 ? "commit" : "commits"} to [${repo}](${repoLink}).`;
  }
  if (event.type === "CreateEvent") {
    const refType = event.payload?.ref_type || "resource";
    const ref = event.payload?.ref || "";
    if (refType === "branch" && ref) {
      return `- ${date}: created branch \`${ref}\` in [${repo}](${repoLink}).`;
    }
    if (refType === "repository") {
      return `- ${date}: created repository [${repo}](${repoLink}).`;
    }
    return `- ${date}: created a ${refType}${ref ? ` \`${ref}\`` : ""} in [${repo}](${repoLink}).`;
  }
  if (event.type === "PullRequestEvent") {
    const action = event.payload?.action || "updated";
    const number = event.payload?.pull_request?.number;
    const url = event.payload?.pull_request?.html_url || repoLink;
    return `- ${date}: ${action} pull request${number ? ` [#${number}](${url})` : ""} in [${repo}](${repoLink}).`;
  }
  if (event.type === "IssuesEvent") {
    const action = event.payload?.action || "updated";
    const number = event.payload?.issue?.number;
    const url = event.payload?.issue?.html_url || repoLink;
    return `- ${date}: ${action} issue${number ? ` [#${number}](${url})` : ""} in [${repo}](${repoLink}).`;
  }
  if (event.type === "IssueCommentEvent") {
    const action = event.payload?.action || "updated";
    const number = event.payload?.issue?.number;
    const url = event.payload?.issue?.html_url || repoLink;
    return `- ${date}: ${action} comment on issue${number ? ` [#${number}](${url})` : ""} in [${repo}](${repoLink}).`;
  }
  if (event.type === "ReleaseEvent") {
    const action = event.payload?.action || "published";
    const tag = event.payload?.release?.tag_name || "";
    return `- ${date}: ${action} release${tag ? ` \`${tag}\`` : ""} in [${repo}](${repoLink}).`;
  }
  if (event.type === "WatchEvent") {
    return `- ${date}: starred [${repo}](${repoLink}).`;
  }
  if (event.type === "ForkEvent") {
    const forked = event.payload?.forkee?.full_name || repo;
    return `- ${date}: forked [${forked}](${repoLink}).`;
  }
  if (event.type === "MemberEvent") {
    const action = event.payload?.action || "updated";
    const member = event.payload?.member?.login || "member";
    return `- ${date}: ${action} member \`${member}\` in [${repo}](${repoLink}).`;
  }
  return null;
}

function replaceActivity(readme, content) {
  const startIndex = readme.indexOf(ACTIVITY_START);
  const endIndex = readme.indexOf(ACTIVITY_END);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("README activity markers are missing or malformed. Regenerate the profile first.");
  }
  return `${readme.slice(0, startIndex + ACTIVITY_START.length)}\n${content}\n${readme.slice(endIndex)}`;
}

async function main() {
  const config = await loadConfig();
  if (!config.activity.enabled) {
    console.log("Recent activity is disabled in profile.config.json.");
    process.exit(0);
  }

  const client = createGitHubClient({ token, username: config.profile.username });
  const events = await client.getUserEvents(50);

  const lines = events
    .map(eventToLine)
    .filter(Boolean)
    .filter((line, index, all) => all.indexOf(line) === index)
    .slice(0, config.activity.limit);

  const content = lines.length ? lines.join("\n") : "_No recent public activity was found._";
  const readmePath = resolve(repositoryRoot, "README.md");
  const readme = await readFile(readmePath, "utf8");
  const nextReadme = replaceActivity(readme, content);

  if (dryRun) {
    console.log(content);
    console.log("\nDry run complete. README.md was not modified.");
  } else {
    await writeFile(readmePath, nextReadme);
    console.log("README.md activity block updated.");
  }
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
