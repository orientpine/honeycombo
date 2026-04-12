type QueryRecord = {
  sql: string;
  params: unknown[];
};

type MockResult = unknown;

type MockD1Controller = {
  db: D1Database;
  getQueries: () => QueryRecord[];
  setResult: (result: MockResult) => void;
  setResults: (results: MockResult[]) => void;
};

function toRows(result: MockResult): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null);
  }

  if (typeof result === 'object' && result !== null) {
    return [result as Record<string, unknown>];
  }

  return [];
}

export function createMockD1(): MockD1Controller {
  const queries: QueryRecord[] = [];
  const queue: MockResult[] = [];
  let defaultResult: MockResult = [];

  const nextResult = (): MockResult => {
    if (queue.length > 0) {
      return queue.shift();
    }

    return defaultResult;
  };

  const createStatement = (sql: string, params: unknown[] = []): D1PreparedStatement => ({
    bind(...boundParams: unknown[]) {
      return createStatement(sql, boundParams);
    },
    async first<T = Record<string, unknown>>(_columnName?: keyof T & string): Promise<T | null> {
      queries.push({ sql, params });
      const rows = toRows(nextResult());
      return (rows[0] as T | undefined) ?? null;
    },
    async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
      queries.push({ sql, params });
      const rows = toRows(nextResult()) as T[];
      return {
        success: true,
        results: rows,
        meta: {
          duration: 0,
          size_after: 0,
          rows_read: rows.length,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
          served_by: 'mock',
          internal_stats: null,
        },
      };
    },
    async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
      queries.push({ sql, params });
      const rows = toRows(nextResult()) as T[];
      return {
        success: true,
        results: rows,
        meta: {
          duration: 0,
          size_after: 0,
          rows_read: 0,
          rows_written: rows.length,
          last_row_id: 0,
          changed_db: rows.length > 0,
          changes: rows.length,
          served_by: 'mock',
          internal_stats: null,
        },
      };
    },
  }) as D1PreparedStatement;

  const db = {
    prepare(sql: string) {
      return createStatement(sql);
    },
    dump() {
      return Promise.resolve(new ArrayBuffer(0));
    },
    batch<T>(statements: D1PreparedStatement[]) {
      return Promise.all(statements.map((statement) => statement.run<T>()));
    },
    exec(_query: string) {
      return Promise.resolve({ count: 0, duration: 0 });
    },
  } as D1Database;

  return {
    db,
    getQueries: () => [...queries],
    setResult(result) {
      defaultResult = result;
      queue.length = 0;
    },
    setResults(results) {
      queue.length = 0;
      queue.push(...results);
    },
  };
}
