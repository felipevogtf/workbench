const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'PLANE_API_URL',
  'PLANE_API_KEY',
  'PLANE_WORKSPACE_SLUG',
  'PLANE_USER_ID',
] as const;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missing = REQUIRED_ENV_VARS.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  return config;
}
