import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'operator';
};

const TOKEN_EXPIRES_IN = '24h';
const COOKIE_NAME = 'shop_session';

async function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!);
}

export async function createToken(user: AuthUser): Promise<string> {
  const secret = await getSecret();
  return new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRES_IN)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const secret = await getSecret();
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.id as number,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as 'admin' | 'operator',
    };
  } catch {
    return null;
  }
}

export async function setSession(user: AuthUser) {
  const token = await createToken(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
