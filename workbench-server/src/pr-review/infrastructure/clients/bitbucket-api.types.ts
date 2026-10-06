// Espejo de lo que responde la API de Bitbucket Cloud 2.0 (solo lo que usamos).

export interface BitbucketPage<T> {
  values: T[];
  next?: string;
}

export interface BitbucketUser {
  uuid: string;
}

export interface BitbucketRepository {
  slug: string;
}

export interface BitbucketPullRequest {
  id: number;
  description?: string | null;
  title: string;
  author: { display_name: string };
  source: { branch: { name: string }; commit: { hash: string } };
  destination: { branch: { name: string } };
  links: { html: { href: string } };
}

export interface BitbucketComment {
  links: { html: { href: string } };
}
