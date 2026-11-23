import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
export const cookieName = "hk_session";
export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function passwordHash(
  value: string,
  salt = randomBytes(16).toString("hex"),
) {
  return salt + ":" + scryptSync(value, salt, 64).toString("hex");
}
export function verifyPassword(value: string, stored: string) {
  return timingSafeEqual(
    Buffer.from(passwordHash(value, stored.split(":")[0])),
    Buffer.from(stored),
  );
}
export async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token: hash(token) },
    select: { expires: true, user: { select: { id: true, email: true } } },
  });
  return session && session.expires > new Date() ? session.user : null;
}
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 30 * 86400000);
  await db.session.create({ data: { token: hash(token), userId, expires } });
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires,
  });
}
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await db.session.deleteMany({ where: { token: hash(token) } });
  jar.delete(cookieName);
}
