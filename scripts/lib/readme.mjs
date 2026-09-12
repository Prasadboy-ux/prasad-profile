import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const ACTIVITY_START = "<!-- AUTO:ACTIVITY:START -->";
export const ACTIVITY_END = "<!-- AUTO:ACTIVITY:END -->";
export const ANALYTICS_START = "<!-- AUTO:ANALYTICS:START -->";
export const ANALYTICS_END = "<!-- AUTO:ANALYTICS:END -->";

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function badgeSegment(value) {
  return encodeURIComponent(String(value).replaceAll("-", "--").replaceAll("_", "__").replaceAll(" ", "_"));
}

function renderLinks(links) {
  return links.map((link) => {
    const logo = link.logo ? `&logo=${encodeURIComponent(link.logo)}&logoColor=white` : "";
    const image = `https://img.shields.io/badge/${badgeSegment(link.label)}-${badgeSegment(link.value)}-${link.color}?style=for-the-badge${logo}`;
    return `  <a href="${link.url}"><img alt="${link.label}" src="${image}"></a>`;
  }).join("\n");
}

function renderFocus(focus) {
  const items = focus.slice(0, 4).map((item) => {
    const icon = item.name.includes("Quality") ? "🏗️" : item.name.includes("Process") ? "📈" : item.name.includes("Inspection") ? "🔬" : "🛠️";
    return `### ${icon} ${item.name}\n${item.description}`;
  });

  const left = items.slice(0, 2).join("\n\n");
  const right = items.slice(2, 4).join("\n\n");

  return `<table>
<tr>
<td width="50%">

${left}

</td>
<td width="50%">

${right}

</td>
</tr>
</table>`;
}

function renderProjects(projects) {
  const cards = projects.slice(0, 4).map((project) => {
    return `<td width="50%">

<h3 align="center">${project.name}</h3>
<p align="center">
  <a href="${project.url}">
    <img src="https://img.shields.io/badge/VIEW_REPO-0A66C2?style=for-the-badge&logo=github&logoColor=white" alt="View Repo" />
  </a>
</p>
<p align="center"><em>${project.summary}</em></p>

</td>`;
  });

  const rows = [];
  for (let i = 0; i < cards.length; i += 2) {
    rows.push(`<tr>\n${cards[i]}${cards[i + 1] ? "\n" + cards[i + 1] : ""}\n</tr>`);
  }

  return `<table>\n${rows.join("\n")}\n</table>`;
}

function renderBar(value, maxValue, maxBars = 14) {
  const filled = Math.max(1, Math.round((value / maxValue) * maxBars));
  return "\u2588".repeat(filled);
}

function renderProfileOverview(overview) {
  return [
    "| Metric | Value |",
    "| --- | --- |",
    `| 📦 Public Repositories | ${overview.publicRepos} |`,
    `| ⭐ Total Stars | ${overview.totalStars} |`,
    `| 🍴 Total Forks | ${overview.totalForks} |`,
    `| 📝 Total Commits | ${overview.totalCommits.toLocaleString()} |`,
    `| 👥 Followers | ${overview.followers} |`,
    `| 👤 Following | ${overview.following} |`
  ].join("\n");
}

function renderLanguageChart(languages, label) {
  if (!languages || languages.length === 0) {
    return `_No ${label.toLowerCase()} data available._`;
  }

  const maxCount = Math.max(...languages.map((l) => l.count || l.commits || 1));
  const maxBars = 14;

  return languages.map((entry) => {
    const count = entry.count || entry.commits || 0;
    const percentage = entry.percentage || 0;
    const labelText = `${entry.language} \u2003 ${renderBar(count, maxCount, maxBars)} ${percentage}%`;
    return `- \`${labelText}\``;
  }).join("\n");
}

function renderAllPublicRepositories(repositories) {
  if (!repositories || repositories.length === 0) {
    return "_No public repositories found._";
  }

  const header = "| Repository | Language | ⭐ Stars | 🍴 Forks | Updated |";
  const divider = "| --- | --- | ---: | ---: | --- |";
  const rows = repositories.map((repo) => {
    const updated = repo.updatedAt ? new Date(repo.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A";
    return `| [**${escapeCell(repo.name)}**](${repo.url}) | ${escapeCell(repo.language)} | ${repo.stars} | ${repo.forks} | ${updated} |`;
  });

  return [header, divider, ...rows].join("\n");
}

function renderMostStarredRepositories(mostStarred) {
  if (!mostStarred || mostStarred.length === 0) {
    return "_No starred repositories found yet._";
  }

  return mostStarred
    .map((repo, index) => `\`${index + 1}.\` [**${escapeCell(repo.name)}**](${repo.url}) — ⭐ ${repo.stars}`)
    .join("\n");
}

function renderAnalyticsSection(analytics, username) {
  if (!analytics) {
    return `\n${ANALYTICS_START}\n_Analytics data will appear here after running npm run generate:analytics._\n${ANALYTICS_END}\n`;
  }

  const profileOverview = renderProfileOverview(analytics.profileOverview);
  const topLanguagesByRepo = renderLanguageChart(analytics.topLanguagesByRepo, "Top Languages by Repository");
  const topLanguagesByCommit = renderLanguageChart(analytics.topLanguagesByCommit, "Top Languages by Commit Activity");
  const allRepos = renderAllPublicRepositories(analytics.repositories);
  const mostStarred = renderMostStarredRepositories(analytics.mostStarred);

  const externalCards = [
    `<img width="49%" src="https://github-profile-summary-cards.vercel.app/api/cards/productive-time?username=${username}&theme=tokyonight&utcOffset=7" alt="Commits Time" />`,
    `<img width="49%" src="https://github-profile-summary-cards.vercel.app/api/cards/profile-details?username=${username}&theme=tokyonight" alt="Contribution Graph" />`
  ].join("\n");

  return [
    "---",
    "",
    "## 📊 GitHub Analytics",
    "",
    "### 📋 Profile Overview",
    "",
    profileOverview,
    "",
    "---",
    "",
    "### 📦 All Public Repositories",
    "",
    allRepos,
    "",
    "---",
    "",
    "### 💻 Top Language by Repository",
    "",
    "> Calculated by counting how many repositories are associated with each primary language.",
    "",
    topLanguagesByRepo,
    "",
    "---",
    "",
    "### 🔥 Top Language by Commit Activity",
    "",
    "> Calculated by summing commit counts across repositories and grouping by repository primary language. A repository's primary language is determined by its largest language bytes on GitHub, not by individual commit contents.",
    "",
    topLanguagesByCommit,
    "",
    "---",
    "",
    "### ⭐ Most Starred Projects",
    "",
    mostStarred,
    "",
    "---",
    "",
    "<p align=\"center\">",
    externalCards,
    "</p>",
    "",
    `${ANALYTICS_START}`,
    "",
    `${ANALYTICS_END}`,
    ""
  ].join("\n");
}

function extractActivity(readme) {
  const startIndex = readme.indexOf(ACTIVITY_START);
  const endIndex = readme.indexOf(ACTIVITY_END);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return null;
  return readme.slice(startIndex + ACTIVITY_START.length, endIndex).trim();
}

async function readExistingActivity(readmePath) {
  try {
    const existing = await readFile(readmePath, "utf8");
    return extractActivity(existing);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function extractAnalytics(readme) {
  const startIndex = readme.indexOf(ANALYTICS_START);
  const endIndex = readme.indexOf(ANALYTICS_END);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return null;
  return readme.slice(startIndex + ANALYTICS_START.length, endIndex).trim();
}

async function readExistingAnalytics(readmePath) {
  try {
    const existing = await readFile(readmePath, "utf8");
    return extractAnalytics(existing);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function loadAnalyticsData(readmePath) {
  try {
    const analyticsPath = resolve(readmePath, "..", "assets", "analytics", "analytics.json");
    const raw = await readFile(analyticsPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function generateProfileReadme({ config, manifest, readmePath, analytics }) {
  const username = config.profile.username;
  const existingActivity = await readExistingActivity(readmePath);
  const activity = existingActivity || "_Recent public activity will appear here after the workflow runs._";

  const resolvedAnalytics = analytics || await loadAnalyticsData(readmePath);
  const analyticsSection = renderAnalyticsSection(resolvedAnalytics, username);

  const readme = `<!-- Generated by GitHub Profile Agent Console. Edit profile.config.json, then run npm run generate. -->

<!-- ═══════════════════════════════════ HEADER ═══════════════════════════════════ -->

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:0B1220,100:0A66C2&height=200&section=header&text=${encodeURIComponent(config.profile.name)}&fontSize=42&fontColor=ffffff&animation=fadeIn&fontAlignY=35&desc=${encodeURIComponent(`${config.profile.headline} \u2022 ${config.profile.affiliation}`)}&descSize=18&descAlignY=55&descColor=94a3b8" alt="header" width="100%" />
</p>

<!-- ═══════════════════════════════════ HERO BANNER ═══════════════════════════════════ -->

<p align="center">
  <picture>
    <source media="(max-width: 760px) and (prefers-color-scheme: dark)" srcset="./assets/hero/${manifest.assets.mobileDark}">
    <source media="(max-width: 760px)" srcset="./assets/hero/${manifest.assets.mobileLight}">
    <source media="(prefers-color-scheme: dark)" srcset="./assets/hero/${manifest.assets.desktopDark}">
    <source media="(prefers-color-scheme: light)" srcset="./assets/hero/${manifest.assets.desktopLight}">
    <img src="./assets/hero/${manifest.assets.desktopDark}" alt="${config.profile.name} - ${config.profile.headline}" width="100%">
  </picture>
</p>

<!-- ═══════════════════════════════════ SOCIAL BADGES ═══════════════════════════════════ -->

<p align="center">
${renderLinks(config.links)}
</p>

<!-- ═══════════════════════════════════ TYPING SVG ═══════════════════════════════════ -->

<p align="center">
  <a href="https://github.com/${username}">
    <img src="https://readme-typing-svg.demolab.com/?font=Fira+Code&weight=600&size=22&pause=1200&color=0A66C2&center=true&vCenter=true&multiline=true&repeat=true&width=650&height=100&lines=Assistant+QA%2FQC+Engineer+%40+PT+HLN+Batam;%F0%9F%94%8D+Root+Cause+Analysis+%C2%B7+SPC+%C2%B7+CAPA+%C2%B7+FMEA;%F0%9F%9B%A0%EF%B8%8F+Building+tools+I+used+to+fill+in+by+hand;%F0%9F%93%8A+Data-Driven+Quality+%C2%B7+Zero+Defects+Mindset" alt="Typing SVG">
  </a>
</p>

<p align="center">
  <img alt="Profile views" src="https://komarev.com/ghpvc/?username=${username}&label=Profile%20Views&color=0A66C2&style=for-the-badge">
  &nbsp;
  <img alt="Followers" src="https://img.shields.io/github/followers/${username}?style=for-the-badge&logo=github&color=0B1220&labelColor=0B1220">
  &nbsp;
  <img alt="Stars" src="https://img.shields.io/github/stars/${username}?style=for-the-badge&logo=github&color=0B1220&labelColor=0B1220&affiliations=OWNER">
</p>

---

<!-- ═══════════════════════════════════ ABOUT ME ═══════════════════════════════════ -->

## <img src="https://media.giphy.com/media/WUlplcMpOCEmTGBtBW/giphy.gif" width="30"> &nbsp;About Me

\`\`\`yaml
Name:       ${config.profile.name}
Role:       ${config.profile.headline}
Company:    ${config.profile.affiliation}
Location:   ${config.profile.location}
Focus:      Quality Assurance · Process Improvement · Statistical Analysis

Certifications:
  - ISO 9001  (Quality Management)
  - ISO 14001 (Environmental Management)
  - ISO 45001 (Occupational Health & Safety)
  - ISO 19011 (Auditing Management Systems)

Tools:      SmartScope · SPC · 8D Reports · FMEA · CAPA · Root Cause Analysis
Languages:  HTML · CSS · JavaScript
Editors:    VS Code · Git
\`\`\`

> *"Quality is not an act, it is a habit."* — Aristotle

---

<!-- ═══════════════════════════════════ CURRENT FOCUS ═══════════════════════════════════ -->

## 🎯 &nbsp;Current Focus

${renderFocus(config.focus)}

---

<!-- ═══════════════════════════════════ TECH STACK ═══════════════════════════════════ -->

## 🧰 &nbsp;Tech Stack & Quality Toolkit

<p align="center">
  <img src="https://skillicons.dev/icons?i=html,css,js,git,vscode,github&theme=dark&perline=6" alt="Dev Tools" />
</p>

<p align="center">
  <img alt="ISO 9001" src="https://img.shields.io/badge/ISO_9001-Quality_Mgmt-0B1220?style=for-the-badge&logoColor=white">
  <img alt="ISO 14001" src="https://img.shields.io/badge/ISO_14001-Environmental-0B1220?style=for-the-badge&logoColor=white">
  <img alt="ISO 45001" src="https://img.shields.io/badge/ISO_45001-OH%26S-0B1220?style=for-the-badge&logoColor=white">
  <img alt="ISO 19011" src="https://img.shields.io/badge/ISO_19011-Auditing-0B1220?style=for-the-badge&logoColor=white">
</p>

<p align="center">
  <img alt="SPC" src="https://img.shields.io/badge/SPC-Statistical_Process_Control-0A66C2?style=flat-square&logo=databricks&logoColor=white">
  <img alt="8D Report" src="https://img.shields.io/badge/8D-Problem_Solving-0A66C2?style=flat-square&logo=target&logoColor=white">
  <img alt="FMEA" src="https://img.shields.io/badge/FMEA-Failure_Mode_Analysis-0A66C2?style=flat-square&logo=codacy&logoColor=white">
  <img alt="CAPA" src="https://img.shields.io/badge/CAPA-Corrective_Action-0A66C2?style=flat-square&logo=checkmarx&logoColor=white">
  <img alt="SmartScope" src="https://img.shields.io/badge/SmartScope-Precision_Measurement-25D366?style=flat-square&logo=openlayers&logoColor=white">
  <img alt="RCA" src="https://img.shields.io/badge/RCA-Root_Cause_Analysis-25D366?style=flat-square&logo=scrutinizerci&logoColor=white">
</p>

---

<!-- ═══════════════════════════════════ FEATURED WORK ═══════════════════════════════════ -->

## 🚀 &nbsp;Featured Projects

${renderProjects(config.projects)}

${analyticsSection}

---

<!-- ═══════════════════════════════════ SNAKE ═══════════════════════════════════ -->

## 🐍 &nbsp;Contribution Snake

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/${username}/${username}/output/github-contribution-grid-snake-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/${username}/${username}/output/github-contribution-grid-snake.svg" />
    <img alt="Snake eating my contributions" src="https://raw.githubusercontent.com/${username}/${username}/output/github-contribution-grid-snake.svg" width="100%" />
  </picture>
</p>

---

<!-- ═══════════════════════════════════ RESEARCH ═══════════════════════════════════ -->

## 🔬 &nbsp;Research Direction

<blockquote>

${config.research.narrative}

</blockquote>

---

<!-- ═══════════════════════════════════ ACTIVITY ═══════════════════════════════════ -->

## ⚡ &nbsp;Recent Activity

${ACTIVITY_START}
${activity}
${ACTIVITY_END}

---

<!-- ═══════════════════════════════════ FOOTER ═══════════════════════════════════ -->

<p align="center">
  <img src="https://quotes-github-readme.vercel.app/api?type=horizontal&theme=tokyonight" alt="Random Dev Quote" />
</p>

<p align="center">
  <b>${escapeCell(config.footer)}</b>
</p>

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:0A66C2,100:0B1220&height=120&section=footer" alt="footer" width="100%" />
</p>
`;

  await writeFile(resolve(readmePath), readme);
  return readme;
}
