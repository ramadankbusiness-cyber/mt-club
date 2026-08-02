import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("[Auth] CRITICAL: JWT_SECRET is not set in environment variables");
}

export default function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.warn(`[Auth] 401 No token — ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ message: "No token" });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    console.warn(`[Auth] 401 Malformed header — ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ message: "Invalid token format" });
  }

  const token = parts[1];
  if (!token) {
    console.warn(`[Auth] 401 Empty token — ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ message: "No token" });
  }

  if (!JWT_SECRET) {
    console.error(`[Auth] 500 JWT_SECRET not configured — ${req.method} ${req.originalUrl}`);
    return res.status(500).json({ message: "Server auth not configured" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    const reason = err.name === "TokenExpiredError" ? "expired" : err.name === "JsonWebTokenError" ? "invalid" : err.message;
    console.warn(`[Auth] 401 ${reason} — ${req.method} ${req.originalUrl}`);
    res.status(401).json({ message: "Invalid token", reason });
  }
}
