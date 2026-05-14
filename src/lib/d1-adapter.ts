/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 统一的数据库适配器接�? * 兼容 Cloudflare D1 �?better-sqlite3
 *
 * 注意：此模块仅在服务端使用，通过 webpack 配置排除客户端打�? */

// Cloudflare D1 Database 接口
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: any[]): Promise<D1Result[]>;
  exec(query: string): Promise<D1Result>;
}

// D1 PreparedStatement 接口
export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = any>(colName?: string): Promise<T | null>;
  run<T = any>(): Promise<D1Result<T>>;
  all<T = any>(): Promise<D1Result<T>>;
}

export interface D1Result<T = any> {
  results?: T[];
  success: boolean;
  meta?: any;
  error?: string;
}

// 统一的数据库接口
export interface DatabaseAdapter {
  prepare(query: string): D1PreparedStatement;
  batch?(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec?(query: string): void;
}

/**
 * Cloudflare D1 适配器（生产环境�? */
export class CloudflareD1Adapter implements DatabaseAdapter {
  constructor(private db: D1Database) {}

  prepare(query: string): D1PreparedStatement {
    return this.db.prepare(query);
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    return this.db.batch(statements as any);
  }
}

/**
 * SQLite 适配器（开发环境）
 * 包装 better-sqlite3 以兼�?D1 API
 */
export class SQLiteAdapter implements DatabaseAdapter {
  private db: any; // better-sqlite3 Database

  constructor(db: any) {
    this.db = db;
  }

  prepare(query: string): D1PreparedStatement {
    const stmt = this.db.prepare(query);
    return new SQLitePreparedStatement(stmt);
  }

  batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    // SQLite 使用事务模拟 batch
    return new Promise((resolve, reject) => {
      try {
        const results: D1Result[] = [];
        const transaction = this.db.transaction(() => {
          for (const stmt of statements) {
            const result = (stmt as any).runSync();
            results.push(result);
          }
        });
        transaction();
        resolve(results);
      } catch (err) {
        reject(err);
      }
    });
  }

  exec(query: string): void {
    this.db.exec(query);
  }
}

/**
 * SQLite PreparedStatement 包装�? * �?better-sqlite3 API 转换�?D1 兼容 API
 */
class SQLitePreparedStatement implements D1PreparedStatement {
  private stmt: any;
  private params: any[] = [];

  constructor(stmt: any) {
    this.stmt = stmt;
  }

  bind(...values: any[]): D1PreparedStatement {
    this.params = values;
    return this;
  }

  async first<T = any>(colName?: string): Promise<T | null> {
    try {
      const result = this.stmt.get(...this.params);
      if (!result) return null;
      if (colName) return result[colName] ?? null;
      return result;
    } catch (err) {
      console.error('SQLite first() error:', err);
      return null;
    }
  }

  async run<T = any>(): Promise<D1Result<T>> {
    try {
      const info = this.stmt.run(...this.params);
      return {
        success: true,
        meta: {
          changes: info.changes,
          last_row_id: info.lastInsertRowid,
        },
      };
    } catch (err: any) {
      console.error('SQLite run() error:', err);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  async all<T = any>(): Promise<D1Result<T>> {
    try {
      const results = this.stmt.all(...this.params);
      return {
        success: true,
        results: results || [],
      };
    } catch (err: any) {
      console.error('SQLite all() error:', err);
      return {
        success: false,
        error: err.message,
        results: [],
      };
    }
  }

  // 同步版本（用�?batch�?  runSync(): D1Result {
    try {
      const info = this.stmt.run(...this.params);
      return {
        success: true,
        meta: {
          changes: info.changes,
          last_row_id: info.lastInsertRowid,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
      };
    }
  }
}
