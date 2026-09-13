import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { schema } from '../../server/db';
import {
  CURRENT_SCHEMA_VERSION,
  LEGACY_BASELINE_VERSION,
  migrationChecksum,
  runMigrations,
  type Migration,
} from '../../server/migrations';

let SQL: SqlJsStatic;

async function freshDatabase() {
  SQL ||= await initSqlJs();
  return new SQL.Database();
}

function tableExists(database: Database, table: string) {
  return database.exec(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${table}'`)[0]?.values.length === 1;
}

describe('migrações formais do banco', () => {
  it('aplica o schema canônico e registra o baseline e a migração atual', async () => {
    const database = await freshDatabase();
    database.run(schema);

    const result = runMigrations(database, { now: () => '2026-09-13T00:00:00.000Z' });

    expect(result.currentVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.applied.map((migration) => migration.version)).toEqual([LEGACY_BASELINE_VERSION, 21, CURRENT_SCHEMA_VERSION]);
    expect(database.exec('PRAGMA index_list(data_integrity_checks)')[0].values.map((row) => row[1])).toContain('idx_data_integrity_checks_status_created');
  });

  it('aplica uma sequência em banco novo e não repete efeitos em segundo boot', async () => {
    const database = await freshDatabase();
    database.run('CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)');
    const migrations: readonly Migration[] = [
      { version: 1, name: 'create_widgets', operations: [{ kind: 'sql', sql: 'CREATE TABLE widgets (id TEXT PRIMARY KEY, name TEXT NOT NULL)' }] },
      { version: 2, name: 'add_widget_timestamp', operations: [{ kind: 'column', table: 'widgets', column: 'created_at', definition: 'TEXT' }] },
    ];
    const now = () => '2026-09-13T00:00:00.000Z';

    const first = runMigrations(database, { migrations, now });
    expect(first.currentVersion).toBe(2);
    expect(first.targetVersion).toBe(2);
    expect(first.applied).toHaveLength(2);
    expect(tableExists(database, 'widgets')).toBe(true);
    expect(database.exec('PRAGMA table_info(widgets)')[0].values.map((row) => row[1])).toContain('created_at');

    const second = runMigrations(database, { migrations, now });
    expect(second.applied).toHaveLength(2);
    expect(database.exec('SELECT COUNT(*) FROM schema_migrations')[0].values[0][0]).toBe(2);
  });

  it('adota o baseline legado sem executar novamente as operações históricas', async () => {
    const database = await freshDatabase();
    database.run('CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)');
    database.run('INSERT INTO app_meta (key, value, updated_at) VALUES (\'schema_version\', \'20\', \'2026-09-12T00:00:00.000Z\')');
    database.run('CREATE TABLE legacy_data (id TEXT PRIMARY KEY)');
    const migrations: readonly Migration[] = [
      { version: LEGACY_BASELINE_VERSION, name: 'baseline', operations: [{ kind: 'sql', sql: 'CREATE TABLE IF NOT EXISTS legacy_data (id TEXT PRIMARY KEY)' }] },
      { version: CURRENT_SCHEMA_VERSION, name: 'add_index', operations: [{ kind: 'sql', sql: 'CREATE INDEX idx_legacy_data_id ON legacy_data(id)' }] },
    ];

    const result = runMigrations(database, { migrations, now: () => '2026-09-13T00:00:00.000Z' });
    expect(result.currentVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.applied.map((migration) => migration.version)).toEqual([LEGACY_BASELINE_VERSION, CURRENT_SCHEMA_VERSION]);
    expect(database.exec('SELECT COUNT(*) FROM schema_migrations')[0].values[0][0]).toBe(2);
  });

  it('detecta alteração do nome ou checksum de uma migração já aplicada', async () => {
    const database = await freshDatabase();
    const migrations: readonly Migration[] = [{ version: 1, name: 'create_items', operations: [{ kind: 'sql', sql: 'CREATE TABLE items (id TEXT PRIMARY KEY)' }] }];
    runMigrations(database, { migrations, now: () => '2026-09-13T00:00:00.000Z' });
    const changed = [{ ...migrations[0], name: 'create_items_changed' }];

    expect(() => runMigrations(database, { migrations: changed, now: () => '2026-09-13T00:00:00.000Z' })).toThrowError(/Checksum da migração 1/);
    expect(migrationChecksum(migrations[0])).not.toBe(migrationChecksum(changed[0]));
  });

  it('faz rollback da migração e não registra versão quando uma operação falha', async () => {
    const database = await freshDatabase();
    const migrations: readonly Migration[] = [{
      version: 1,
      name: 'failing_migration',
      operations: [
        { kind: 'sql', sql: 'CREATE TABLE rollback_probe (id TEXT PRIMARY KEY)' },
        { kind: 'sql', sql: 'INSERT INTO table_that_does_not_exist VALUES (1)' },
      ],
    }];

    expect(() => runMigrations(database, { migrations, now: () => '2026-09-13T00:00:00.000Z' })).toThrowError(/Falha na migração 1/);
    expect(tableExists(database, 'rollback_probe')).toBe(false);
    expect(database.exec('SELECT COUNT(*) FROM schema_migrations')[0].values[0][0]).toBe(0);
  });

  it('recusa um banco que declara versão mais nova que a aplicação', async () => {
    const database = await freshDatabase();
    database.run('CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)');
    database.run('INSERT INTO app_meta (key, value, updated_at) VALUES (\'schema_version\', \'999\', \'2026-09-13T00:00:00.000Z\')');

    expect(() => runMigrations(database, { now: () => '2026-09-13T00:00:00.000Z' })).toThrowError(/Banco mais novo/);
  });
});
