import 'dotenv/config';

const production = process.env.NODE_ENV === 'production';
const configuredSecret = String(process.env.LOCAL_AUTH_SECRET || '').trim();

if (production && configuredSecret.length < 32) {
  throw new Error('LOCAL_AUTH_SECRET deve ter pelo menos 32 caracteres em produção.');
}

export const isProduction = production;
export const authSecret = configuredSecret || 'otica-nordestina-local-development-secret';
export const sessionTtlSeconds = Math.max(900, Number(process.env.AUTH_SESSION_TTL_SECONDS || (production ? 8 * 60 * 60 : 7 * 24 * 60 * 60)));
export const allowInitialSignup = process.env.ALLOW_INITIAL_SIGNUP === 'true';
export const allowLocalResetToken = !production && process.env.ALLOW_LOCAL_RESET_TOKEN !== 'false';

export const corsOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const minimumPasswordLength = 12;

export function assertPasswordPolicy(password: string) {
  if (password.length < minimumPasswordLength) {
    throw Object.assign(new Error(`A senha precisa ter pelo menos ${minimumPasswordLength} caracteres.`), { statusCode: 400 });
  }
}

export function clientAddress(request: { ip?: string; socket?: { remoteAddress?: string } }) {
  return String(request.ip || request.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
}

export function configuredCorsOrigin(origin: string | undefined) {
  if (!origin) return true;
  if (!production) return true;
  return corsOrigins.includes(origin);
}
