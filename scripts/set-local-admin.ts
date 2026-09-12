import bcrypt from 'bcryptjs';
import { execute, initDatabase, newId, now, persistDatabase, selectRows } from '../server/db.js';

const email = process.env.LOCAL_ADMIN_EMAIL || 'admin@admin.com';
const password = process.env.LOCAL_ADMIN_PASSWORD || 'kaliel123';
const name = 'Administrador Master';

await initDatabase();

const role = selectRows('SELECT id FROM roles WHERE name = ?', ['admin_master'])[0];
const requestedUser = selectRows('SELECT id FROM profiles WHERE lower(email) = ? LIMIT 1', [email.toLowerCase()])[0];
const currentMaster = selectRows("SELECT id FROM profiles WHERE role = 'admin_master' ORDER BY created_at LIMIT 1")[0];
const targetId = requestedUser?.id || currentMaster?.id || newId();
const passwordHash = await bcrypt.hash(password, 10);

if (requestedUser || currentMaster) {
  execute(
    'UPDATE profiles SET name = ?, email = ?, role = ?, role_id = ?, status = ?, password_hash = ? WHERE id = ?',
    [name, email, 'admin_master', role?.id || null, 'active', passwordHash, targetId],
  );
} else {
  execute(
    'INSERT INTO profiles (id, name, email, role, role_id, companies, stores, status, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [targetId, name, email, 'admin_master', role?.id || null, '[]', '[]', 'active', passwordHash, now()],
  );
}

// Remove apenas duplicatas do mesmo e-mail, preservando o usuário promovido.
execute('DELETE FROM profiles WHERE lower(email) = ? AND id <> ?', [email.toLowerCase(), targetId]);
persistDatabase();
console.log(`Usuário master configurado: ${email}`);
