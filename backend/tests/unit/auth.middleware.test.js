import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import auth from "../../middleware/auth.js";

const JWT_SECRET = process.env.JWT_SECRET || "MTCLUB_SECRET";

function mockReq(authHeader) {
  return { headers: { authorization: authHeader } };
}
function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

describe("Auth Middleware", () => {
  it("returns 401 when no Authorization header", () => {
    const req = mockReq(undefined);
    const res = mockRes();
    auth(req, res, () => {});
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("No token");
  });

  it("returns 401 with malformed header (no Bearer prefix)", () => {
    const token = jwt.sign({ id: 1, role: "member" }, JWT_SECRET);
    const req = mockReq(token);
    const res = mockRes();
    auth(req, res, () => {});
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 with invalid token", () => {
    const req = mockReq("Bearer invalidtoken123");
    const res = mockRes();
    auth(req, res, () => {});
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid token");
  });

  it("returns 401 with expired token", () => {
    const token = jwt.sign({ id: 1, role: "member" }, JWT_SECRET, { expiresIn: "-1h" });
    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();
    auth(req, res, () => {});
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid token");
  });

  it("calls next() and sets req.user with valid token", () => {
    const payload = { id: 42, role: "admin", committee: "tech" };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();
    let called = false;
    auth(req, res, () => { called = true; });
    expect(called).toBe(true);
    expect(req.user.id).toBe(42);
    expect(req.user.role).toBe("admin");
    expect(req.user.committee).toBe("tech");
  });

  it("handles empty Bearer value", () => {
    const req = mockReq("Bearer ");
    const res = mockRes();
    auth(req, res, () => {});
    expect(res.statusCode).toBe(401);
  });
});
