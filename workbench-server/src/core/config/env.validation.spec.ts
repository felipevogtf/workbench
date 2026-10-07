import { validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgres://x',
  PLANE_API_URL: 'https://plane',
  PLANE_API_KEY: 'k',
  PLANE_WORKSPACE_SLUG: 'ws',
  PLANE_USER_ID: 'u',
  REVIEWS_DIR: '/data/reviews',
};

describe('validateEnv', () => {
  it('accepts the required variables alone', () => {
    expect(() => validateEnv(base)).not.toThrow();
  });

  it('lists the required variables that are missing', () => {
    expect(() =>
      validateEnv({ ...base, PLANE_API_KEY: '', REVIEWS_DIR: undefined }),
    ).toThrow(/PLANE_API_KEY, REVIEWS_DIR/);
  });

  it('wants a PR provider complete or absent', () => {
    expect(() => validateEnv({ ...base, BITBUCKET_EMAIL: 'a@b' })).toThrow(
      /Incomplete bitbucket/,
    );
    expect(() => validateEnv({ ...base, GITHUB_TOKEN: 't' })).not.toThrow();
  });

  it.each(['REVIEW_CONCURRENCY', 'PLANNER_CONCURRENCY'])(
    '%s must be an integer of 1 or more',
    (name) => {
      expect(() => validateEnv({ ...base, [name]: '0' })).toThrow(name);
      expect(() => validateEnv({ ...base, [name]: '1.5' })).toThrow(name);
      expect(() => validateEnv({ ...base, [name]: '3' })).not.toThrow();
    },
  );

  it('treats an empty optional variable as not defined', () => {
    expect(() =>
      validateEnv({ ...base, REVIEW_CONCURRENCY: '', PLANNER_CONCURRENCY: '' }),
    ).not.toThrow();
  });
});
