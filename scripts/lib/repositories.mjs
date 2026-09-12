import { createGitHubClient } from "./github-api.mjs";

export async function fetchProfileOverview({ token, username }) {
  const authenticated = Boolean(token);
  const client = createGitHubClient({ token, username, authenticated });
  const user = await client.getUser();
  return {
    publicRepos: user.public_repos ?? 0,
    followers: user.followers ?? 0,
    following: user.following ?? 0
  };
}

export async function fetchAllPublicRepositories({ token, username }) {
  const client = createGitHubClient({ token, username, authenticated: Boolean(token) });
  const repos = await client.getRepositories(100);

  const normalized = (Array.isArray(repos) ? repos : []).map((repo) => {
    const updatedAt = repo.updated_at ? new Date(repo.updated_at) : null;
    const createdAt = repo.created_at ? new Date(repo.created_at) : null;

    return {
      name: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      description: repo.description || "",
      language: repo.language || "Unknown",
      stars: repo.stargazers_count ?? 0,
      forks: repo.forks_count ?? 0,
      openIssues: repo.open_issues_count ?? 0,
      isArchived: repo.archived ?? false,
      isFork: repo.fork ?? false,
      updatedAt: updatedAt ? updatedAt.toISOString() : null,
      createdAt: createdAt ? createdAt.toISOString() : null,
      defaultBranch: repo.default_branch || "main",
      size: repo.size ?? 0
    };
  });

  return normalized;
}

export async function fetchRepositoryCommitCount({ token, username, repo }) {
  const client = createGitHubClient({ token, username, authenticated: Boolean(token) });

  try {
    const { data, headers } = await client.getWithHeaders(
      `https://api.github.com/repos/${username}/${repo}/commits?per_page=1`,
      { retries: false }
    );
    let total = Array.isArray(data) ? data.length : 0;

    const linkHeader = headers.link || "";
    const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
    if (lastMatch) {
      total = Number(lastMatch[1]);
    }

    return { repo, count: total };
  } catch {
    return { repo, count: null };
  }
}

export async function fetchRepositoryLanguages({ token, username, repo }) {
  const client = createGitHubClient({ token, username, authenticated: Boolean(token) });
  try {
    const data = await client.getRepositoryLanguages(username, repo);
    if (typeof data === "object" && data !== null) {
      return { repo, languages: data };
    }
    return { repo, languages: {} };
  } catch {
    return { repo, languages: {} };
  }
}

export async function fetchCommitCountsForRepositories({ token, username, repositories }) {
  const results = [];
  const batchSize = 10;

  for (let i = 0; i < repositories.length; i += batchSize) {
    const batch = repositories.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((repo) => fetchRepositoryCommitCount({ token, username, repo: repo.name }))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({ repo: batch[results.length]?.name || "unknown", count: null });
      }
    }
  }

  return results;
}

export async function fetchLanguageDataForRepositories({ token, username, repositories }) {
  const results = [];
  const batchSize = 10;

  for (let i = 0; i < repositories.length; i += batchSize) {
    const batch = repositories.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((repo) => fetchRepositoryLanguages({ token, username, repo: repo.name }))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({ repo: batch[results.length]?.name || "unknown", languages: {} });
      }
    }
  }

  return results;
}

export async function fetchRecentPublicActivity({ token, username, limit = 30 }) {
  const client = createGitHubClient({ token, username, authenticated: Boolean(token) });
  const events = await client.getUserEvents(limit);

  const relevantTypes = new Set([
    "PushEvent",
    "CreateEvent",
    "PullRequestEvent",
    "IssuesEvent",
    "IssueCommentEvent",
    "ReleaseEvent",
    "ForkEvent",
    "WatchEvent",
    "MemberEvent"
  ]);

  return (Array.isArray(events) ? events : [])
    .filter((event) => relevantTypes.has(event.type))
    .slice(0, limit);
}
