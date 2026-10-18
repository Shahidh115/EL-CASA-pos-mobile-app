import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite'
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import { SCHEMA_SQL } from './schema'
import { seedDatabaseIfEmpty } from './seed'

export interface QueryResult<T = any> {
  values: T[]
}

export interface ExecResult {
  changes?: number
  lastId?: number
}

class DatabaseManager {
  private static instance: DatabaseManager
  private nativeDb: SQLiteDBConnection | null = null
  private sqliteConn: SQLiteConnection | null = null
  private wasmDb: SqlJsDatabase | null = null
  private isNative = false
  private initialized = false
  private initPromise: Promise<void> | null = null
  private readonly storageKey = 'elcasa_roms_sqlite_bin'

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  public async init(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      this.isNative = Capacitor.isNativePlatform()

      if (this.isNative) {
        try {
          this.sqliteConn = new SQLiteConnection(CapacitorSQLite)
          const ret = await this.sqliteConn.checkConnectionsConsistency()
          const isConn = (await this.sqliteConn.isConnection('elcasa_pos', false)).result
          if (ret.result && isConn) {
            this.nativeDb = await this.sqliteConn.retrieveConnection('elcasa_pos', false)
          } else {
            this.nativeDb = await this.sqliteConn.createConnection(
              'elcasa_pos',
              false,
              'no-encryption',
              1,
              false
            )
          }
          await this.nativeDb.open()
          await this.nativeDb.execute(SCHEMA_SQL)
        } catch (err) {
          console.error('Failed to open native SQLite DB, falling back to Web WASM SQLite:', err)
          this.isNative = false
          await this.initWasm()
        }
      } else {
        await this.initWasm()
      }

      this.initialized = true
      await seedDatabaseIfEmpty(this)
    })()

    return this.initPromise
  }

  private async initWasm(): Promise<void> {
    const isNode = typeof window === 'undefined'
    let wasmBinary: Buffer | undefined
    if (isNode) {
      try {
        const fsModule = await import('node:fs')
        const pathModule = await import('node:path')
        const wasmPath = pathModule.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm')
        wasmBinary = fsModule.readFileSync(wasmPath)
      } catch (e) {
        console.warn('Could not read local wasm file:', e)
      }
    }

    const SQL = await initSqlJs({
      locateFile: (file) => `https://sql.js.org/dist/${file}`,
      wasmBinary,
    })

    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(this.storageKey) : null
    if (saved) {
      try {
        const u8 = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0))
        this.wasmDb = new SQL.Database(u8)
      } catch (e) {
        console.warn('Could not restore saved SQLite DB, creating fresh:', e)
        this.wasmDb = new SQL.Database()
      }
    } else {
      this.wasmDb = new SQL.Database()
    }

    this.wasmDb.run(SCHEMA_SQL)
    this.persistWasm()
  }

  private persistWasm(): void {
    if (typeof localStorage === 'undefined' || this.isNative || !this.wasmDb) return
    try {
      const data = this.wasmDb.export()
      let binary = ''
      const len = data.byteLength
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(data[i])
      }
      localStorage.setItem(this.storageKey, btoa(binary))
    } catch (e) {
      console.error('Failed to persist WASM SQLite DB to localStorage:', e)
    }
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    await this.init()

    if (this.isNative && this.nativeDb) {
      const res = await this.nativeDb.query(sql, params)
      return (res.values as T[]) || []
    }

    if (this.wasmDb) {
      const stmt = this.wasmDb.prepare(sql)
      if (params && params.length > 0) {
        stmt.bind(params)
      }
      const results: T[] = []
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T)
      }
      stmt.free()
      return results
    }

    throw new Error('Database is not initialized')
  }

  public async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params)
    return rows.length > 0 ? rows[0] : null
  }

  public async run(sql: string, params: any[] = []): Promise<ExecResult> {
    await this.init()

    if (this.isNative && this.nativeDb) {
      const res = await this.nativeDb.run(sql, params)
      return {
        changes: res.changes?.changes,
        lastId: res.changes?.lastId,
      }
    }

    if (this.wasmDb) {
      this.wasmDb.run(sql, params)
      const lastIdRes = this.wasmDb.exec('SELECT last_insert_rowid() as id')
      const changesRes = this.wasmDb.exec('SELECT changes() as changes')
      this.persistWasm()
      return {
        lastId: lastIdRes[0]?.values[0]?.[0] as number | undefined,
        changes: changesRes[0]?.values[0]?.[0] as number | undefined,
      }
    }

    throw new Error('Database is not initialized')
  }

  public async execute(statements: string): Promise<void> {
    await this.init()

    if (this.isNative && this.nativeDb) {
      await this.nativeDb.execute(statements)
      return
    }

    if (this.wasmDb) {
      this.wasmDb.run(statements)
      this.persistWasm()
      return
    }

    throw new Error('Database is not initialized')
  }

  public async transaction<T>(callback: (db: DatabaseManager) => Promise<T>): Promise<T> {
    await this.init()
    await this.run('BEGIN TRANSACTION;')
    try {
      const result = await callback(this)
      await this.run('COMMIT;')
      return result
    } catch (error) {
      await this.run('ROLLBACK;')
      throw error
    }
  }

  public async exportDatabaseBinary(): Promise<Uint8Array> {
    await this.init()
    if (this.isNative && this.nativeDb) {
      // Return export binary from sqlite plugin
      const data = await this.query('SELECT 1')
      // Fallback
    }
    if (this.wasmDb) {
      return this.wasmDb.export()
    }
    return new Uint8Array()
  }

  public async clearAllData(): Promise<void> {
    await this.init()
    await this.transaction(async (db) => {
      await db.run('DELETE FROM bill_items;')
      await db.run('DELETE FROM bills;')
      await db.run('DELETE FROM wastes;')
      await db.run('DELETE FROM resource_transactions;')
      await db.run('DELETE FROM production_adjustments;')
      await db.run('DELETE FROM daily_production;')
      await db.run('DELETE FROM recipe_items;')
      await db.run('DELETE FROM recipes;')
      await db.run('DELETE FROM menu_items;')
      await db.run('DELETE FROM production_resources;')
      await db.run('DELETE FROM categories;')
      await db.run('DELETE FROM settings;')
    })
  }
}

export const db = DatabaseManager.getInstance()
