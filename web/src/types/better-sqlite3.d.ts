declare module "better-sqlite3" {
  export type SqliteValue = string | number | bigint | Uint8Array | null;

  export type RunResult = {
    changes: number;
    lastInsertRowid: number | bigint;
  };

  export interface Statement<T = unknown> {
    get(...params: SqliteValue[]): T;
    all(...params: SqliteValue[]): T[];
    run(...params: SqliteValue[]): RunResult;
  }

  export interface Database {
    pragma(value: string): unknown;
    exec(sql: string): void;
    prepare<T = unknown>(sql: string): Statement<T>;
    transaction<T>(fn: () => T): () => T;
    close(): void;
  }

  export interface Options {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (message?: unknown, ...args: unknown[]) => void;
  }

  export default class BetterSqlite3 {
    constructor(filename: string, options?: Options);
    pragma(value: string): unknown;
    exec(sql: string): void;
    prepare<T = unknown>(sql: string): Statement<T>;
    transaction<T>(fn: () => T): () => T;
    close(): void;
  }
}


