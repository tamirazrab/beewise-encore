import "./gateway";
import { api } from "encore.dev/api";
import { APIError } from "encore.dev/api";
// import { secret } from "encore.dev/config";
import { getAuthData } from "~encore/auth";
import { authDB } from "./db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { RegisterRequest, LoginRequest, AuthResponse, User } from "./types";

// const JWT_SECRET_SECRET = secret("JWT_SECRET");
// const JWT_SECRET = JWT_SECRET_SECRET() || process.env.JWT_SECRET || "change-me-in-production";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES_IN = "7d";

export const register = api(
  { method: "POST", path: "/register", expose: true },
  async (req: RegisterRequest): Promise<AuthResponse> => {
    const { email, password } = req;

    if (!email || !password) {
      throw APIError.invalidArgument("Email and password are required");
    }

    const existingUser = await authDB.queryRow<User>`
      SELECT id, email, created_at, updated_at
      FROM users
      WHERE email = ${email}
    `;

    if (existingUser) {
      throw APIError.alreadyExists("User with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await authDB.queryRow<User>`
      INSERT INTO users (email, password_hash)
      VALUES (${email}, ${passwordHash})
      RETURNING id, email, created_at, updated_at
    `;

    if (!user) {
      throw APIError.internal("Failed to create user");
    }

    const token = jwt.sign({ user_id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    return { user, token };
  }
);

export const login = api(
  { method: "POST", path: "/login", expose: true },
  async (req: LoginRequest): Promise<AuthResponse> => {
    const { email, password } = req;

    if (!email || !password) {
      throw APIError.invalidArgument("Email and password are required");
    }

    const userWithHash = await authDB.queryRow<{
      id: string;
      email: string;
      password_hash: string;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT id, email, password_hash, created_at, updated_at
      FROM users
      WHERE email = ${email}
    `;

    if (!userWithHash) {
      throw APIError.unauthenticated("Invalid email or password");
    }

    const isValid = await bcrypt.compare(password, userWithHash.password_hash);
    if (!isValid) {
      throw APIError.unauthenticated("Invalid email or password");
    }

    const user: User = {
      id: userWithHash.id,
      email: userWithHash.email,
      created_at: userWithHash.created_at,
      updated_at: userWithHash.updated_at,
    };

    const token = jwt.sign({ user_id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    return { user, token };
  }
);

export const getCurrentUser = api(
  { method: "GET", path: "/me", auth: true },
  async (req: {}): Promise<User> => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("User ID not found in request");
    }

    const user = await authDB.queryRow<User>`
      SELECT id, email, created_at, updated_at
      FROM users
      WHERE id = ${authData.userID}
    `;

    if (!user) {
      throw APIError.notFound("User not found");
    }

    return user;
  }
);
