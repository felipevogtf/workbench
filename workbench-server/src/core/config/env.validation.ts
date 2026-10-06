const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'PLANE_API_URL',
  'PLANE_API_KEY',
  'PLANE_WORKSPACE_SLUG',
  'PLANE_USER_ID',
  'REVIEWS_DIR',
] as const;

// Cada provider de PRs es opcional, pero si se configura debe estar completo.
const PROVIDER_ENV_VARS = {
  bitbucket: ['BITBUCKET_EMAIL', 'BITBUCKET_TOKEN', 'BITBUCKET_WORKSPACE'],
  github: ['GITHUB_TOKEN'],
} as const;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missing: string[] = REQUIRED_ENV_VARS.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  for (const [provider, keys] of Object.entries(PROVIDER_ENV_VARS)) {
    const present = keys.filter((key) => config[key]);
    if (present.length > 0 && present.length < keys.length) {
      const absent = keys.filter((key) => !config[key]);
      throw new Error(
        `Incomplete ${provider} configuration, missing: ${absent.join(', ')}`,
      );
    }
  }

  // Una variable vacía cuenta como no definida (se usa el valor por defecto).
  const concurrency = config['REVIEW_CONCURRENCY'];
  if (
    concurrency &&
    (!Number.isInteger(Number(concurrency)) || Number(concurrency) < 1)
  ) {
    throw new Error('REVIEW_CONCURRENCY must be an integer >= 1');
  }

  return config;
}
