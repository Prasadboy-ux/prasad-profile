import { setTimeout as delay } from "node:timers/promises";

export function createGitHubClient({ token, username, authenticated = false } = {}) {
  if (!username) {
    throw new Error("A GitHub username is required.");
  }

  const baseHeaders = {
    Accept: "application/vnd.github+json",
    "User-Agent": `${username}-profile-readme`,
    "X-GitHub-Api-Version": "2022-11-28"
  };

  function authHeaders() {
    if (!token || !authenticated) return baseHeaders;
    return { ...baseHeaders, Authorization: `Bearer ${token}` };
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
      signal: options.signal
    });

    const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
    const rateLimitReset = response.headers.get("X-RateLimit-Reset");

    if (rateLimitRemaining === "0") {
      const resetDate = rateLimitReset ? new Date(Number(rateLimitReset) * 1000) : new Date(Date.now() + 60_000);
      const waitMs = Math.max(0, resetDate.getTime() - Date.now() + 1000);
      await delay(waitMs);
      return request(url, options);
    }

    if (response.status === 403 && response.headers.get("X-RateLimit-Remaining") === "0") {
      const retryAfter = response.headers.get("Retry-After");
      const waitMs = retryAfter ? Number(retryAfter) * 1000 : 60_000;
      await delay(waitMs);
      return request(url, options);
    }

    if (response.status === 202 && options.retries !== false) {
      if ((options.retries || 0) < 3) {
        await delay(2000);
        return request(url, { ...options, retries: (options.retries || 0) + 1 });
      }
    }

    if (!response.ok) {
      let body;
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }
      const message = typeof body === "string" ? body : body?.message || response.statusText;
      throw new Error(`GitHub API ${response.status}: ${message}`);
    }

    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    return response.text();
  }

  async function get(url, options = {}) {
    return request(url, { ...options, method: "GET" });
  }

  async function getAllPages(url, options = {}) {
    const results = [];
    let currentUrl = url;
    let iterations = 0;
    const maxIterations = 100;

    while (currentUrl && iterations < maxIterations) {
      iterations += 1;
      const data = await get(currentUrl, options);

      if (Array.isArray(data)) {
        results.push(...data);
        if (data.length === 0) break;
      } else if (data) {
        results.push(data);
        break;
      } else {
        break;
      }

      currentUrl = null;
    }

    return results;
  }

  async function getWithHeaders(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
      signal: options.signal
    });

    const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
    const rateLimitReset = response.headers.get("X-RateLimit-Reset");

    if (rateLimitRemaining === "0") {
      const resetDate = rateLimitReset ? new Date(Number(rateLimitReset) * 1000) : new Date(Date.now() + 60_000);
      const waitMs = Math.max(0, resetDate.getTime() - Date.now() + 1000);
      await delay(waitMs);
      return getWithHeaders(url, options);
    }

    if (response.status === 403 && response.headers.get("X-RateLimit-Remaining") === "0") {
      const retryAfter = response.headers.get("Retry-After");
      const waitMs = retryAfter ? Number(retryAfter) * 1000 : 60_000;
      await delay(waitMs);
      return getWithHeaders(url, options);
    }

    if (response.status === 202 && options.retries !== false) {
      if ((options.retries || 0) < 3) {
        await delay(2000);
        return getWithHeaders(url, { ...options, retries: (options.retries || 0) + 1 });
      }
    }

    if (!response.ok) {
      let body;
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }
      const message = typeof body === "string" ? body : body?.message || response.statusText;
      throw new Error(`GitHub API ${response.status}: ${message}`);
    }

    const contentType = response.headers.get("content-type") || "";
    let data = null;
    if (response.status !== 204) {
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    }

    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return { data, headers };
  }

  async function getUser() {
    if (authenticated && token) {
      return get("https://api.github.com/user");
    }
    return get(`https://api.github.com/users/${username}`);
  }

  async function getUserEvents(perPage = 50) {
    return getAllPages(`https://api.github.com/users/${username}/events/public?per_page=${perPage}`);
  }

  async function getRepositories(perPage = 100) {
    return getAllPages(`https://api.github.com/users/${username}/repos?per_page=${perPage}&type=public&sort=updated`);
  }

  async function getRepository(owner, repo) {
    return get(`https://api.github.com/repos/${owner}/${repo}`);
  }

  async function getRepositoryCommits(owner, repo, perPage = 1) {
    const commits = await getAllPages(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}`,
      { retries: false }
    );
    return Array.isArray(commits) ? commits : [];
  }

  async function getRepositoryLanguages(owner, repo) {
    const data = await get(`https://api.github.com/repos/${owner}/${repo}/languages`);
    return typeof data === "object" && data !== null ? data : {};
  }

  return {
    getUser,
    getUserEvents,
    getRepositories,
    getRepository,
    getRepositoryCommits,
    getRepositoryLanguages,
    getWithHeaders
  };
}
