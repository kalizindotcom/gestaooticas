import fs from 'node:fs';
import initSqlJs from 'sql.js';

const dbPath = new URL('./data/otica-nordestina.sqlite', import.meta.url);
const SQL = await initSqlJs();
const db = new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)));
const rows = db.exec("SELECT id, description, amount, status, origin_table, origin_id, reversed_entry_id, reversal_reason, created_at, updated_at FROM financial_entries ORDER BY created_at DESC LIMIT 12");
console.log(JSON.stringify(rows, null, 2));
