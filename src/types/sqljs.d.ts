declare module "sql.js/dist/sql-wasm-inline.js" {
  interface SqlJsQueryResult {
    columns: string[];
    values: unknown[][];
  }
  interface SqlJsDatabase {
    exec(sql: string): SqlJsQueryResult[];
    close(): void;
  }
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Uint8Array) => SqlJsDatabase;
  }
  export default function initSqlJs(): Promise<SqlJsStatic>;
}
