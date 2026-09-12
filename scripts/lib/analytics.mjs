function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

export function calculateProfileOverview({ repositories, overview, commitsByRepo }) {
  const totalStars = repositories.reduce((sum, repo) => sum + repo.stars, 0);
  const totalForks = repositories.reduce((sum, repo) => sum + repo.forks, 0);
  const totalCommits = commitsByRepo.reduce((sum, entry) => sum + (entry.count || 0), 0);

  return {
    publicRepos: repositories.length,
    totalStars,
    totalForks,
    totalCommits,
    followers: overview.followers,
    following: overview.following
  };
}

export function calculateTopLanguagesByRepository(repositories) {
  const languageCounts = {};

  for (const repo of repositories) {
    const lang = repo.language || "Unknown";
    languageCounts[lang] = (languageCounts[lang] || 0) + 1;
  }

  const total = repositories.length || 1;
  const sorted = Object.entries(languageCounts)
    .map(([language, count]) => ({
      language,
      count,
      percentage: roundToTwo((count / total) * 100)
    }))
    .sort((a, b) => b.count - a.count);

  return sorted;
}

export function calculateTopLanguagesByCommit(repositories, commitsByRepo, languageDataByRepo) {
  const languageCommitCounts = {};

  for (let i = 0; i < repositories.length; i += 1) {
    const repo = repositories[i];
    const commitCount = commitsByRepo[i]?.count || 0;
    const langData = languageDataByRepo[i]?.languages || {};

    let primaryLanguage = repo.language || "Unknown";

    const langKeys = Object.keys(langData);
    if (langKeys.length > 0) {
      let maxBytes = 0;
      let maxLang = primaryLanguage;
      for (const [lang, bytes] of Object.entries(langData)) {
        if (bytes > maxBytes) {
          maxBytes = bytes;
          maxLang = lang;
        }
      }
      primaryLanguage = maxLang || primaryLanguage;
    }

    if (!languageCommitCounts[primaryLanguage]) {
      languageCommitCounts[primaryLanguage] = 0;
    }
    languageCommitCounts[primaryLanguage] += commitCount;
  }

  const totalCommits = Object.values(languageCommitCounts).reduce((sum, count) => sum + count, 0) || 1;
  const sorted = Object.entries(languageCommitCounts)
    .map(([language, commits]) => ({
      language,
      commits,
      percentage: roundToTwo((commits / totalCommits) * 100)
    }))
    .sort((a, b) => b.commits - a.commits);

  return sorted;
}

export function calculateMostStarredRepositories(repositories, limit = 5) {
  return repositories
    .filter((repo) => repo.stars > 0)
    .sort((a, b) => b.stars - a.stars)
    .slice(0, limit);
}

export function calculateAllAnalytics({ repositories, overview, commitsByRepo, languageDataByRepo }) {
  const profileOverview = calculateProfileOverview({ repositories, overview, commitsByRepo });
  const topLanguagesByRepo = calculateTopLanguagesByRepository(repositories);
  const topLanguagesByCommit = calculateTopLanguagesByCommit(repositories, commitsByRepo, languageDataByRepo);
  const mostStarred = calculateMostStarredRepositories(repositories, 5);

  return {
    profileOverview,
    topLanguagesByRepo,
    topLanguagesByCommit,
    mostStarred,
    repositories
  };
}
