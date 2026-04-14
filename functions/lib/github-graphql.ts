import type { Discussion, DiscussionsListResponse, Env } from './types';

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const REPO_OWNER = 'orientpine';
const REPO_NAME = 'honeycombo';
const REPO_ID = 'R_kgDOR_fpgQ';

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

async function graphqlRequest<T>(
  token: string | undefined,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'HoneyCombo/1.0',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json()) as GraphQLResponse<T>;

  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed (${response.status}): ${JSON.stringify(payload.errors ?? payload.data ?? {})}`);
  }

  if (payload.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${payload.errors.map((error) => error.message).join('; ')}`);
  }

  if (!payload.data) {
    throw new Error('GitHub GraphQL error: empty response payload');
  }

  return payload.data;
}

export async function queryDiscussions(
  env: Env,
  categoryId: string,
  first: number = 20,
  after?: string,
): Promise<DiscussionsListResponse> {
  try {
    const data = await graphqlRequest<{
      repository: {
        discussions: {
          totalCount: number;
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{
            number: number;
            title: string;
            createdAt: string;
            author: { login: string; avatarUrl: string } | null;
            comments: { totalCount: number };
            url: string;
          } | null>;
        } | null;
      } | null;
    }>(
      env.GITHUB_BOT_TOKEN,
      `query QueryDiscussions($categoryId: ID!, $first: Int!, $after: String) {
        repository(owner: "${REPO_OWNER}", name: "${REPO_NAME}") {
          discussions(first: $first, after: $after, categoryId: $categoryId, orderBy: { field: CREATED_AT, direction: DESC }) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              number
              title
              createdAt
              author {
                login
                avatarUrl
              }
              comments {
                totalCount
              }
              url
            }
          }
        }
      }`,
      { categoryId, first, after },
    );

    const discussions = data.repository?.discussions;
    if (!discussions) {
      return { discussions: [], pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 0 };
    }

    return {
      discussions: discussions.nodes.filter((node): node is NonNullable<typeof node> => node !== null),
      pageInfo: discussions.pageInfo,
      totalCount: discussions.totalCount,
    };
  } catch (error) {
    throw new Error(`Failed to query GitHub discussions: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getDiscussion(env: Env, number: number): Promise<Discussion | null> {
  try {
    const data = await graphqlRequest<{
      repository: {
        discussion: {
          number: number;
          title: string;
          bodyHTML: string;
          createdAt: string;
          author: { login: string; avatarUrl: string } | null;
          comments: { totalCount: number };
          url: string;
        } | null;
      } | null;
    }>(
      env.GITHUB_BOT_TOKEN,
      `query GetDiscussion($number: Int!) {
        repository(owner: "${REPO_OWNER}", name: "${REPO_NAME}") {
          discussion(number: $number) {
            number
            title
            bodyHTML
            createdAt
            author {
              login
              avatarUrl
            }
            comments {
              totalCount
            }
            url
          }
        }
      }`,
      { number },
    );

    const discussion = data.repository?.discussion;
    if (!discussion) {
      return null;
    }

    return discussion;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/not found|could not resolve/i.test(message)) {
      return null;
    }
    throw new Error(`Failed to get GitHub discussion #${number}: ${message}`);
  }
}

export async function createDiscussion(
  env: Env,
  categoryId: string,
  title: string,
  body: string,
  authorUsername: string,
): Promise<{ id: string; number: number }> {
  if (!env.GITHUB_BOT_TOKEN) {
    throw new Error('GITHUB_BOT_TOKEN is required to create discussions');
  }

  const attributedBody = `> 📝 @${authorUsername} 님이 HoneyCombo에서 작성\n\n${body}`;

  try {
    const data = await graphqlRequest<{
      createDiscussion: {
        discussion: { id: string; number: number } | null;
      } | null;
    }>(
      env.GITHUB_BOT_TOKEN,
      `mutation CreateDiscussion($categoryId: ID!, $title: String!, $body: String!) {
        createDiscussion(input: { repositoryId: "${REPO_ID}", categoryId: $categoryId, title: $title, body: $body }) {
          discussion {
            id
            number
          }
        }
      }`,
      { categoryId, title, body: attributedBody },
    );

    const discussion = data.createDiscussion?.discussion;
    if (!discussion) {
      throw new Error('GitHub discussion creation returned no discussion');
    }

    return discussion;
  } catch (error) {
    throw new Error(`Failed to create GitHub discussion: ${error instanceof Error ? error.message : String(error)}`);
  }
}
