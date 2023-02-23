import { Pool, createPool, PoolConfig } from "promise-mysql";
import { StandardizedDatabaseConnectionOptions } from "../../models/models.mjs";
import DatabaseServiceInterface from "./databaseServiceInterface.mjs";

export default class Mysql implements DatabaseServiceInterface {
  private tables: { tableName: string; tableSchema: string }[] | null = null;
  public pool: Pool | undefined;

  async connect(databaseConnectionOptions: StandardizedDatabaseConnectionOptions): Promise<void> {
    const config: PoolConfig = databaseConnectionOptions;
    if (databaseConnectionOptions.sslCertificate) {
      config.ssl = {
        ca: databaseConnectionOptions.sslCertificate,
      };
    }
    this.pool = await createPool(config);
  }

  private prepareTableName(tableName: string, schemaName?: string): string {
    if (schemaName) {
      return `\`${schemaName}\`.\`${tableName}\``;
    }
    return `\`${tableName}\``;
  }

  private async getAllTables(): Promise<{ tableName: string; tableSchema: string }[]> {
    if (!this.pool) throw new Error("Pool is not initialized");
    if (this.tables) return Promise.resolve(this.tables);
    const tablesResult = await this.pool.query(
      `SELECT table_name, table_schema
            FROM information_schema.tables
            where table_type='BASE TABLE' AND table_schema != 'information_schema';`,
    );
    const res = tablesResult.map((table: any) => {
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
    const count = await this.pool.query(
      `SELECT count(*) as \`total\` from ${this.prepareTableName(tableName, schemaName)};`,
    );
    return count[0].total;
  }

  async countRowsForAllTables(): Promise<{ tableName: string; schemaName?: string; count: number }[]> {
    if (!this.pool) throw new Error("Pool is not initialized");
    const tables = await this.getAllTables();
    const res = [];
    for (const table of tables) {
      const count = await this.countRows(table.tableName, table.tableSchema);
      res.push({
        tableName: table.tableName,
        schemaName: table.tableSchema,
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
          query += ` WHERE \`${key}\` = ?`;
        } else {
          query += ` AND \`${key}\` = ?`;
        }
        params.push(filter[key]);
      });
    }
    return await this.pool.query(query, params);
  }

  async disconnect(): Promise<void> {
    if (!this.pool) throw new Error("Pool is not initialized");
    await this.pool.end();
  }
}
