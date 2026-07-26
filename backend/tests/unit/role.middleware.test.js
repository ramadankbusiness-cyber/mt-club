import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { requireAdmin, requireLeaderOrAdmin, requireMember, requireRole } from "../../middleware/role.js";

const JWT_SECRET = "MTCLUB_SECRET";

function signToken(role, extra = {}) {
  return jwt.sign({ id: 1, role, ...extra }, JWT_SECRET, { expiresIn: "1h" });
}

function mockReq(role) {
  return { headers: { authorization: `Bearer ${signToken(role)}` }, user: null };
}
function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}
function nextFn() { nextFn.called = true; }

describe("requireAdmin", () => {
  beforeEach(() => { nextFn.called = false; });

  it("allows admin role", () => {
    const req = mockReq("admin");
    requireAdmin(req, mockRes(), nextFn);
    expect(nextFn.called).toBe(true);
  });

  it("rejects leader role", () => {
    const res = mockRes();
    requireAdmin(mockReq("leader"), res, nextFn);
    expect(res.statusCode).toBe(403);
    expect(nextFn.called).toBe(false);
  });

  it("rejects member role", () => {
    const res = mockRes();
    requireAdmin(mockReq("member"), res, nextFn);
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 when no token", () => {
    const res = mockRes();
    requireAdmin({ headers: {} }, res, nextFn);
    expect(res.statusCode).toBe(401);
  });
});

describe("requireLeaderOrAdmin", () => {
  beforeEach(() => { nextFn.called = false; });

  it("allows admin", () => {
    requireLeaderOrAdmin(mockReq("admin"), mockRes(), nextFn);
    expect(nextFn.called).toBe(true);
  });

  it("allows leader", () => {
    requireLeaderOrAdmin(mockReq("leader"), mockRes(), nextFn);
    expect(nextFn.called).toBe(true);
  });

  it("rejects member", () => {
    const res = mockRes();
    requireLeaderOrAdmin(mockReq("member"), res, nextFn);
    expect(res.statusCode).toBe(403);
  });
});

describe("requireMember", () => {
  beforeEach(() => { nextFn.called = false; });

  it("allows admin", () => {
    requireMember(mockReq("admin"), mockRes(), nextFn);
    expect(nextFn.called).toBe(true);
  });

  it("allows leader", () => {
    requireMember(mockReq("leader"), mockRes(), nextFn);
    expect(nextFn.called).toBe(true);
  });

  it("allows member", () => {
    requireMember(mockReq("member"), mockRes(), nextFn);
    expect(nextFn.called).toBe(true);
  });
});

describe("requireRole", () => {
  beforeEach(() => { nextFn.called = false; });

  it("allows listed role", () => {
    requireRole("admin", "leader")(mockReq("leader"), mockRes(), nextFn);
    expect(nextFn.called).toBe(true);
  });

  it("rejects unlisted role", () => {
    const res = mockRes();
    requireRole("admin")(mockReq("member"), res, nextFn);
    expect(res.statusCode).toBe(403);
  });
});
