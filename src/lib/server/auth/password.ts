import { hash, verify } from '@node-rs/argon2';

// argon2id (Algorithm.Argon2id = 2)
const opts = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, opts);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | null = null;
/** Verify gegen Dummy-Hash, damit unbekannte E-Mails gleich lange dauern (Timing-Angriffe). */
export async function dummyVerify(password: string): Promise<void> {
  dummy ??= hashPassword('dummy-password-for-timing');
  await verifyPassword(await dummy, password);
}
