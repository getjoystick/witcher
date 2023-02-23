import fs from "fs";
import pg from "pg";
import { DatabaseConnectionOptions } from "../../models/models.mjs";
import DatabaseServiceInterface from "./databaseServiceInterface.mjs";

export default class Postgres implements DatabaseServiceInterface {
  private tables: { tableName: string; tableSchema: string }[] | null = null;
  public pool: pg.Pool | undefined;

  async connect(databaseConnectionOptions: DatabaseConnectionOptions): Promise<void> {
    const config: pg.PoolConfig = databaseConnectionOptions;
    if (databaseConnectionOptions.sslCertificatePath) {
      config.ssl = {
        ca: fs.readFileSync(databaseConnectionOptions.sslCertificatePath).toString(),
      };
    }
    this.pool = new pg.Pool(config);
  }

  private prepareTableName(tableName: string, schemaName?: string): string {
    if (schemaName) {
      return `"${schemaName}"."${tableName}"`;
    }
    return `"${tableName}"`;
  }

  private async getAllTables(): Promise<{ tableName: string; tableSchema: string }[]> {
    if (!this.pool) throw new Error("Pool is not initialized");
    if (this.tables) return Promise.resolve(this.tables);
    const tablesResult = await this.pool.query(
      `SELECT table_name, table_schema
            FROM information_schema.tables 
            where table_type='BASE TABLE' AND table_schema != 'pg_catalog' AND table_schema != 'information_schema';`,
    );
    const res = tablesResult.rows.map((table: any) => {
      return {
        tableName: table.table_name,
        tableSchema: table.table_schema,
      };
    });

    this.tables = res;
    return res;
  }

  public async countRows(tableName: string, schemaName?: string): Promise<number> {
    if (!this.pool) throw new Error("Pool is not initialized");
    const result = await this.pool.query(
      `SELECT count(*) as "total" from ${this.prepareTableName(tableName, schemaName)};`,
    );

    return result.rows[0].total;
  }

  public async countRowsForAllTables(): Promise<{ tableName: string; schemaName?: string; count: number }[]> {
    if (!this.pool) throw new Error("Pool is not initialized");
    const tablesResult = await this.pool.query(
      `SELECT table_name, table_schema
            FROM information_schema.tables 
            where table_type='BASE TABLE' AND table_schema != 'pg_catalog' AND table_schema != 'information_schema';`,
    );

    const res = [];
    for (const table of tablesResult.rows) {
      const count = await this.countRows(table.table_name, table.table_schema);
      table.count = count;
      res.push({
        tableName: table.table_name,
        schemaName: table.table_schema,
        count: count,
      });
    }
    return res;
  }

  public async getRowsByFilter(
    tableName: string,
    filter?: { [key: string]: any },
    schemaName?: string,
  ): Promise<any[]> {
    if (!this.pool) throw new Error("Pool is not initialized");
    let query = `SELECT * from ${this.prepareTableName(tableName, schemaName)}`;
    const params: any[] = [];
    if (filter) {
      Object.keys(filter).forEach((key, index) => {
        if (index == 0) {
          query += ` WHERE "${key}" = $${index + 1}`;
        } else {
          query += ` AND "${key}" = $${index + 1}`;
        }
        params.push(filter[key]);
      });
    }
    const result = await this.pool.query(query, params);
    return result.rows;
  }
}
