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
}) =>
    jwt.sign(u, env.JWT_SECRET, {
        expiresIn: "15m",
        issuer: "securefile",
        audience: "securefile-app",
    });
export const verifyAccess = (t: string) =>
    jwt.verify(t, env.JWT_SECRET, {
        issuer: "securefile",
        audience: "securefile-app",
    }) as { id: string; role: string; companyId: string | null };
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
