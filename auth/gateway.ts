import { Header, Gateway } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import jwt from "jsonwebtoken";

// Use Encore secrets with fallback to environment variables for local development
const JWT_SECRET_SECRET = secret("JWT_SECRET");
const JWT_SECRET = JWT_SECRET_SECRET() || process.env.JWT_SECRET || "change-me-in-production";

interface AuthParams {
  authorization: Header<"Authorization">;
}

interface AuthData {
  userID: string;
}

export const auth = authHandler<AuthParams, AuthData>(
  async (params) => {
    const authHeader = params.authorization;
    if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
      throw APIError.unauthenticated("Missing or invalid authorization header");
    }

    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { user_id: string; email?: string };
      return { userID: decoded.user_id };
    } catch {
      throw APIError.unauthenticated("Invalid or expired token");
    }
  }
);

export const gateway = new Gateway({
  authHandler: auth,
});
