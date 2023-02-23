import { StandardizedDatabaseConnectionOptions } from "../../models/models.mjs";

export default interface DatabaseServiceInterface {
  connect(databaseConnectionOptions: StandardizedDatabaseConnectionOptions): Promise<void>;
  countRows(tableName: string, schemaName?: string): Promise<number>;
  getRowsByFilter(
    tableName: string,
    filter?: { [key: string]: unknown },
    schemaName?: string,
  ): Promise<Record<string, unknown>[]>;
  countRowsForAllTables(): Promise<{ tableName: string; schemaName?: string; count: number }[]>;
}
