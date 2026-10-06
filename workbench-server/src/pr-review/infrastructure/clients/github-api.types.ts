// Espejo de lo que responde la API REST de GitHub (solo lo que usamos).

export interface GithubSearchItem {
  number: number;
  /** https://api.github.com/repos/{owner}/{repo} */
  repository_url: string;
}

export interface GithubSearchResponse {
  total_count: number;
  items: GithubSearchItem[];
}

export interface GithubPullRequest {
  number: number;
  title: string;
  html_url: string;
  user: { login: string } | null;
  head: { ref: string; sha: string };
  base: { ref: string };
}

export interface GithubComment {
  html_url: string;
}
