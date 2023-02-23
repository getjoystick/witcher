import Mysql from "./mysql.mjs";
import { Pool, createPool } from "promise-mysql";

describe("Mysql", () => {
  let dbService: Mysql;
  let testDbPool: Pool;
  beforeAll(async () => {
    dbService = new Mysql();
    await dbService.connect({
      dbms: "mysql",
      host: "localhost",
      database: "dbname",
      user: "user",
      password: "password",
    });
    testDbPool = await createPool({
      host: "localhost",
      database: "dbname",
      user: "user",
      password: "password",
    });
    await testDbPool.query(`CREATE TABLE IF NOT EXISTS test_table (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      PRIMARY KEY (id)
    )`);
    await testDbPool.query(`CREATE TABLE IF NOT EXISTS test_table2 (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      PRIMARY KEY (id)
    )`);
    await testDbPool.query(`CREATE TABLE IF NOT EXISTS test_table3 (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      PRIMARY KEY (id)
    )`);
  });
  afterAll(async () => {
    await testDbPool.query(`DROP TABLE IF EXISTS test_table`);
    await testDbPool.query(`DROP TABLE IF EXISTS test_table2`);
    await testDbPool.query(`DROP TABLE IF EXISTS test_table3`);
    await testDbPool.end();
    await dbService.disconnect();
  });

  beforeEach(async () => {
    await testDbPool.query(`DELETE FROM test_table`);
  });

  afterEach(async () => {
    await testDbPool.query(`DELETE FROM test_table`);
  });

  test("countRows", async () => {
    expect(await dbService.countRows("test_table")).toEqual(0);
    await testDbPool.query(`INSERT INTO test_table (name) VALUES ('test')`);
    expect(await dbService.countRows("test_table")).toEqual(1);
    await testDbPool.query(`INSERT INTO test_table (name) VALUES ('test2')`);
    expect(await dbService.countRows("test_table")).toEqual(2);
    await testDbPool.query(`DELETE FROM test_table`);
    expect(await dbService.countRows("test_table")).toEqual(0);
  });

  test("getRowsByFilter", async () => {
    expect(await dbService.getRowsByFilter("test_table")).toEqual([]);
    await testDbPool.query(`INSERT INTO test_table (id,name) VALUES (1,'test')`);
    await testDbPool.query(`INSERT INTO test_table (id,name) VALUES (2,'test2')`);
    await testDbPool.query(`INSERT INTO test_table (id,name) VALUES (3,'test3')`);
    expect(await dbService.getRowsByFilter("test_table")).toEqual([
      { id: 1, name: "test" },
      { id: 2, name: "test2" },
      { id: 3, name: "test3" },
    ]);
    expect(await dbService.getRowsByFilter("test_table", { id: 1 })).toEqual([{ id: 1, name: "test" }]);
    expect(await dbService.getRowsByFilter("test_table", { name: "test" })).toEqual([{ id: 1, name: "test" }]);
    expect(await dbService.getRowsByFilter("test_table", { name: "test4" })).toEqual([]);
  });

  test("countRowsForAllTables", async () => {
    expect(await dbService.countRowsForAllTables()).toEqual([
      { count: 0, schemaName: "dbname", tableName: "test_table" },
      { count: 0, schemaName: "dbname", tableName: "test_table2" },
      { count: 0, schemaName: "dbname", tableName: "test_table3" },
    ]);
    await testDbPool.query(`INSERT INTO test_table (id,name) VALUES (1,'test')`);
    await testDbPool.query(`INSERT INTO test_table (id,name) VALUES (2,'test2')`);
    await testDbPool.query(`INSERT INTO test_table (id,name) VALUES (3,'test3')`);
    expect(await dbService.countRowsForAllTables()).toEqual([
      { count: 3, schemaName: "dbname", tableName: "test_table" },
      { count: 0, schemaName: "dbname", tableName: "test_table2" },
      { count: 0, schemaName: "dbname", tableName: "test_table3" },
    ]);
    await testDbPool.query(`INSERT INTO test_table2 (id,name) VALUES (1,'test1')`);
    expect(await dbService.countRowsForAllTables()).toEqual([
      { count: 3, schemaName: "dbname", tableName: "test_table" },
      { count: 1, schemaName: "dbname", tableName: "test_table2" },
      { count: 0, schemaName: "dbname", tableName: "test_table3" },
    ]);
  });
});
