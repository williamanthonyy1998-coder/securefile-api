import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { env } from "../config/env";

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);
export const signAccess = (u: {
    id: string;
    role: string;
    companyId: string | null;
    email?: string;
}) =>
    jwt.sign(u, env.JWT_SECRET, {
        expiresIn: "7d",
        issuer: "securefile",
        audience: "securefile-app",
    });
export const verifyAccess = (t: string) =>
    jwt.verify(t, env.JWT_SECRET, {
        issuer: "securefile",
        audience: "securefile-app",
    }) as { id: string; role: string; companyId: string | null; email?: string };
export const randomToken = () => crypto.randomBytes(32).toString("hex");
export const hashToken = (token: string) =>
    crypto.createHash("sha256").update(token).digest("hex");
export const safeFilename = (name: string) =>
    name
        .replace(/[\\/\0]/g, "_")
        .replace(/[<>:"|?*]/g, "_")
        .trim()
        .slice(0, 255) || "file";
export const safeSlug = (name: string) =>
    name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50) || "company";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function randomTotpSecret(length = 20) {
    const bytes = crypto.randomBytes(length);
    let secret = "";
    for (let i = 0; i < length; i++) secret += BASE32_ALPHABET[bytes[i] & 31];
    return secret;
}
export function base32Decode(input: string) {
    const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
    let bits = "";
    for (const char of clean) {
        const value = BASE32_ALPHABET.indexOf(char);
        if (value < 0) continue;
        bits += value.toString(2).padStart(5, "0");
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
    return Buffer.from(bytes);
}
export function totpCode(secret: string, time = Date.now()) {
    const counter = Math.floor(time / 30000);
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));
    const digest = crypto.createHmac("sha1", base32Decode(secret)).update(buf).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
    return String(binary % 1000000).padStart(6, "0");
}
export function verifyTotpCode(secret: string, codeRaw: unknown, window = 1) {
    const code = String(codeRaw || "").replace(/\D/g, "");
    if (!/^\d{6}$/.test(code)) return false;
    for (let delta = -window; delta <= window; delta++) {
        if (totpCode(secret, Date.now() + delta * 30000) === code) return true;
    }
    return false;
}
export function totpUri(secret: string, email: string, issuer = "SecureFile") {
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
export function signTwoFactorChallenge(userId: string) {
    return jwt.sign({ id: userId, purpose: "2fa" }, env.JWT_SECRET, { expiresIn: "5m", issuer: "securefile-2fa", audience: "securefile-2fa" });
}
export function verifyTwoFactorChallenge(token: string) {
    return jwt.verify(token, env.JWT_SECRET, { issuer: "securefile-2fa", audience: "securefile-2fa" }) as { id: string; purpose: string };
}
