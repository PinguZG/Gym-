import { eq } from 'drizzle-orm';
import { db, schema } from '../src/lib/server/db/index';
import { hashPassword } from '../src/lib/server/auth/password';

const [emailArg, password] = process.argv.slice(2);
if (!emailArg || !password) {
  console.error('Usage: tsx scripts/create-user.ts email passwort');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Passwort muss mindestens 10 Zeichen haben.');
  process.exit(1);
}
const email = emailArg.trim().toLowerCase();
if (db.select().from(schema.users).where(eq(schema.users.email, email)).get()) {
  console.error(`User ${email} existiert bereits.`);
  process.exit(1);
}
db.insert(schema.users).values({ email, passwordHash: await hashPassword(password) }).run();
console.log(`User ${email} angelegt.`);
