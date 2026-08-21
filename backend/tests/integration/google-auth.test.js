import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import express from "express";

const JWT_SECRET = "MTCLUB_SECRET";

vi.stubEnv("GOOGLE_CLIENT_ID", "279707701038-vkcsuruav5ri7jke9c5rqlanri2ohdof.apps.googleusercontent.com");
vi.stubEnv("JWT_SECRET", JWT_SECRET);

vi.mock("express-rate-limit", () => ({
  default: () => (req, res, next) => next(),
}));

const FAKE_JWT = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.eyJmYWtlIjoic2lnbmF0dXJlIn0";

vi.mock("../../config/supabase.js", () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

vi.mock("../../utils/storage.js", () => ({
  uploadToStorage: vi.fn().mockResolvedValue("https://storage.example.com/test.jpg"),
}));

vi.mock("../../utils/points.js", () => ({
  calculateUserPoints: vi.fn().mockResolvedValue({ total: 10, attendanceCount: 2, attendancePoints: 10, adjustmentPoints: 0, adjustmentHistory: [] }),
  calculateLeaderboard: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../middleware/role.js", () => ({
  requireAdmin: (req, res, next) => { req.user = req.user || {}; req.user.role = "admin"; next(); },
  requireLeaderOrAdmin: (req, res, next) => { req.user = req.user || {}; req.user.role = "leader"; next(); },
  requireMember: (req, res, next) => { req.user = req.user || {}; next(); },
  requireRole: () => (req, res, next) => next(),
}));

const mockVerifyIdToken = vi.fn();
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken(...args) {
      return mockVerifyIdToken(...args).then(payload => ({ getPayload: () => payload }));
    }
  },
}));

import authRoutes from "../../routes/auth.js";
import { supabase } from "../../config/supabase.js";

function makeToken(payload = {}) {
  return jwt.sign({ id: 1, role: "member", committee: null, ...payload }, JWT_SECRET, { expiresIn: "1h" });
}

function mockQuery(data = null, error = null) {
  const q = {
    _data: data, _error: error,
    select: function () { this._chain.push("select"); return this; },
    insert: function () { this._chain.push("insert"); return this; },
    update: function () { this._chain.push("update"); return this; },
    delete: function () { this._chain.push("delete"); return this; },
    eq: function () { this._chain.push("eq"); return this; },
    neq: function () { return this; },
    ilike: function () { this._chain.push("ilike"); return this; },
    in: function () { return this; },
    order: function () { return this; },
    limit: function () { return this; },
    single: function () { return Promise.resolve({ data: this._data, error: this._error }); },
    maybeSingle: function () { return Promise.resolve({ data: this._data, error: this._error }); },
    upsert: function () { return this; },
    group: function () { return this; },
    having: function () { return this; },
    _chain: [],
    then: function (resolve, reject) {
      return Promise.resolve({ data: this._data, error: this._error }).then(resolve, reject);
    },
  };
  return q;
}

let app;

describe("Google Auth Routes", () => {
  beforeAll(() => {
    app = express();
    app.use(express.json({ limit: "5mb" }));
    app.use("/api/auth", authRoutes);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    supabase.from.mockReturnValue(mockQuery());
  });

  describe("POST /api/auth/google/link", () => {
    it("rejects missing credential", async () => {
      const token = makeToken();
      const res = await request(app)
        .post("/api/auth/google/link")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("links Google account successfully", async () => {
      const token = makeToken({ id: 1 });
      mockVerifyIdToken.mockResolvedValue({
        sub: "google-link-456",
        email: "link@gmail.com",
        name: "Link User",
        picture: "https://lh3.googleusercontent.com/photo.jpg",
        email_verified: true,
      });

      let callCount = 0;
      supabase.from.mockImplementation((table) => {
        callCount++;
        if (table === "members") {
          // 1st: reject if google_id exists on another member
          if (callCount === 1) return mockQuery(null, null);
          // 2nd: check current user's google_id
          if (callCount === 2) return mockQuery({ google_id: null });
          // 3rd: the actual update
          return mockQuery(null, null);
        }
        return mockQuery();
      });

      const res = await request(app)
        .post("/api/auth/google/link")
        .set("Authorization", `Bearer ${token}`)
        .send({ credential: FAKE_JWT });
      expect(res.status).toBe(200);
      expect(res.body.linked).toBe(true);
      expect(res.body.googleSub).toBe("google-link-456");
    });

    it("rejects if Google account already linked to ANOTHER member", async () => {
      const token = makeToken({ id: 1 });
      mockVerifyIdToken.mockResolvedValue({
        sub: "google-used-789",
        email: "taken@gmail.com",
        name: "Taken",
        picture: null,
        email_verified: true,
      });

      let callCount = 0;
      supabase.from.mockImplementation((table) => {
        callCount++;
        if (table === "members") {
          // 1st: reject if google_id exists on another member
          if (callCount === 1) return mockQuery({ id: 2, email: "other@test.com" });
          return mockQuery();
        }
        return mockQuery();
      });

      const res = await request(app)
        .post("/api/auth/google/link")
        .set("Authorization", `Bearer ${token}`)
        .send({ credential: FAKE_JWT });
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already linked to another member/i);
    });

    it("returns idempotent success if same Google already linked to this user", async () => {
      const token = makeToken({ id: 1 });
      mockVerifyIdToken.mockResolvedValue({
        sub: "google-link-456",
        email: "link@gmail.com",
        name: "Link User",
        picture: null,
        email_verified: true,
      });

      let callCount = 0;
      supabase.from.mockImplementation((table) => {
        callCount++;
        if (table === "members") {
          // 1st: reject if google_id exists on another member (no match)
          if (callCount === 1) return mockQuery(null, null);
          // 2nd: check current user's google_id (already matches!)
          if (callCount === 2) return mockQuery({ google_id: "google-link-456" });
          return mockQuery();
        }
        return mockQuery();
      });

      const res = await request(app)
        .post("/api/auth/google/link")
        .set("Authorization", `Bearer ${token}`)
        .send({ credential: FAKE_JWT });
      expect(res.status).toBe(200);
      expect(res.body.linked).toBe(true);
    });

    it("rejects if user already linked to a different Google account", async () => {
      const token = makeToken({ id: 1 });
      mockVerifyIdToken.mockResolvedValue({
        sub: "google-new-diff",
        email: "newdiff@gmail.com",
        name: "New Diff",
        picture: null,
        email_verified: true,
      });

      let callCount = 0;
      supabase.from.mockImplementation((table) => {
        callCount++;
        if (table === "members") {
          // 1st: reject if google_id exists on another member (no match)
          if (callCount === 1) return mockQuery(null, null);
          // 2nd: check current user's google_id (different sub!)
          if (callCount === 2) return mockQuery({ google_id: "google-old-different" });
          return mockQuery();
        }
        return mockQuery();
      });

      const res = await request(app)
        .post("/api/auth/google/link")
        .set("Authorization", `Bearer ${token}`)
        .send({ credential: FAKE_JWT });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("ALREADY_LINKED_DIFFERENT");
    });
  });

  describe("POST /api/auth/google/login", () => {
    function googlePayload(overrides = {}) {
      return {
        sub: "google-login-123",
        email: "member@gmail.com",
        name: "Member One",
        picture: "https://lh3.googleusercontent.com/photo.jpg",
        email_verified: true,
        ...overrides,
      };
    }

    function memberRow(overrides = {}) {
      return {
        id: 1,
        name: "Member One",
        email: "member@gmail.com",
        role: "member",
        enabled: 1,
        password: "hashed",
        profile_image: "",
        committee: null,
        google_id: null,
        google_verified: false,
        ...overrides,
      };
    }

    it("rejects missing credential", async () => {
      const res = await request(app)
        .post("/api/auth/google/login")
        .send({});
      expect(res.status).toBe(400);
    });

    it("rejects a failed token verification", async () => {
      mockVerifyIdToken.mockRejectedValue(new Error("GOOGLE_VERIFY_FAIL: Token expired"));

      const res = await request(app)
        .post("/api/auth/google/login")
        .send({ credential: FAKE_JWT });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("VERIFICATION_FAILED");
    });

    it("rejects when no member matches the Google email or linked Google account", async () => {
      mockVerifyIdToken.mockResolvedValue(googlePayload());

      let callCount = 0;
      supabase.from.mockImplementation((table) => {
        callCount++;
        if (table === "members") {
          // 1st: email lookup misses
          if (callCount === 1) return mockQuery([]);
          // 2nd: google_id fallback also misses
          return mockQuery(null, null);
        }
        return mockQuery();
      });

      const res = await request(app)
        .post("/api/auth/google/login")
        .send({ credential: FAKE_JWT });
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/no account found/i);
    });

    it("logs in an already-linked member whose Google email differs from their member email", async () => {
      mockVerifyIdToken.mockResolvedValue(googlePayload({ sub: "google-login-123", email: "personal@gmail.com" }));

      let callCount = 0;
      supabase.from.mockImplementation((table) => {
        callCount++;
        if (table === "members") {
          // 1st: email lookup misses (member email is on the club domain)
          if (callCount === 1) return mockQuery([]);
          // 2nd: google_id fallback finds the linked member
          if (callCount === 2) {
            return mockQuery(memberRow({ email: "member@mtclub.com", google_id: "google-login-123", google_verified: true }));
          }
          return mockQuery(null, null);
        }
        return mockQuery();
      });

      const res = await request(app)
        .post("/api/auth/google/login")
        .send({ credential: FAKE_JWT });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.googleSub).toBe("google-login-123");
      expect(res.body.googleVerified).toBe(true);
      expect(res.body.email).toBe("member@mtclub.com");
      expect(res.body.id).toBe(1);

      const decoded = jwt.verify(res.body.token, JWT_SECRET);
      expect(decoded.id).toBe(1);
      expect(decoded.role).toBe("member");
    });

    it("rejects a disabled member", async () => {
      mockVerifyIdToken.mockResolvedValue(googlePayload());
      supabase.from.mockReturnValue(mockQuery([memberRow({ enabled: 0 })]));

      const res = await request(app)
        .post("/api/auth/google/login")
        .send({ credential: FAKE_JWT });
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/disabled/i);
    });

    it("rejects if Google account is already linked to another member", async () => {
      mockVerifyIdToken.mockResolvedValue(googlePayload());

      let callCount = 0;
      supabase.from.mockImplementation((table) => {
        callCount++;
        if (table === "members") {
          // 1st: email lookup finds this member
          if (callCount === 1) return mockQuery([memberRow()]);
          // 2nd: google_id lookup finds ANOTHER member
          return mockQuery({ id: 2, email: "other@test.com" });
        }
        return mockQuery();
      });

      const res = await request(app)
        .post("/api/auth/google/login")
        .send({ credential: FAKE_JWT });
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already linked to another member/i);
    });

    it("rejects if the member is linked to a different Google account", async () => {
      mockVerifyIdToken.mockResolvedValue(googlePayload());

      let callCount = 0;
      supabase.from.mockImplementation((table) => {
        callCount++;
        if (table === "members") {
          if (callCount === 1) return mockQuery([memberRow({ google_id: "google-old-different" })]);
          return mockQuery(null, null);
        }
        return mockQuery();
      });

      const res = await request(app)
        .post("/api/auth/google/login")
        .send({ credential: FAKE_JWT });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("ALREADY_LINKED_DIFFERENT");
    });

    it("auto-links and logs in a member who never linked a Google account", async () => {
      mockVerifyIdToken.mockResolvedValue(googlePayload());

      let callCount = 0;
      supabase.from.mockImplementation((table) => {
        callCount++;
        if (table === "members") {
          if (callCount === 1) return mockQuery([memberRow()]);
          if (callCount === 2) return mockQuery(null, null);
          return mockQuery(null, null);
        }
        return mockQuery();
      });

      const res = await request(app)
        .post("/api/auth/google/login")
        .send({ credential: FAKE_JWT });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.googleSub).toBe("google-login-123");
      expect(res.body.googleVerified).toBe(true);
      expect(res.body.id).toBe(1);
      expect(res.body.email).toBe("member@gmail.com");

      const decoded = jwt.verify(res.body.token, JWT_SECRET);
      expect(decoded.id).toBe(1);
      expect(decoded.role).toBe("member");
    });

    it("logs in a member whose Google account is already linked", async () => {
      mockVerifyIdToken.mockResolvedValue(googlePayload());

      let callCount = 0;
      supabase.from.mockImplementation((table) => {
        callCount++;
        if (table === "members") {
          if (callCount === 1) return mockQuery([memberRow({ google_id: "google-login-123", google_verified: true })]);
          return mockQuery(null, null);
        }
        return mockQuery();
      });

      const res = await request(app)
        .post("/api/auth/google/login")
        .send({ credential: FAKE_JWT });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.googleSub).toBe("google-login-123");
      expect(res.body.googleVerified).toBe(true);
    });
  });

  describe("DELETE /api/auth/google/unlink", () => {
    it("unlinks Google account successfully", async () => {
      const token = makeToken({ id: 1 });
      supabase.from.mockReturnValue(mockQuery(null, null));

      const res = await request(app)
        .delete("/api/auth/google/unlink")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.unlinked).toBe(true);
    });

    it("returns 401 without auth token", async () => {
      const res = await request(app)
        .delete("/api/auth/google/unlink");
      expect(res.status).toBe(401);
    });

    it("returns 500 on database error", async () => {
      const token = makeToken({ id: 1 });
      supabase.from.mockReturnValue(mockQuery(null, { message: "db failure" }));

      const res = await request(app)
        .delete("/api/auth/google/unlink")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(500);
    });
  });

  describe("GET /api/auth/google/status", () => {
    it("returns Google status with googleSub", async () => {
      const token = makeToken({ id: 1 });
      supabase.from.mockReturnValue(mockQuery({
        google_id: "google-sub-123",
        google_linked: true,
        google_email: "user@gmail.com",
        google_name: "G User",
        google_picture: "https://photo.jpg",
        google_verified: true,
        google_linked_at: "2025-01-01T00:00:00Z",
      }));

      const res = await request(app)
        .get("/api/auth/google/status")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.linked).toBe(true);
      expect(res.body.googleSub).toBe("google-sub-123");
      expect(res.body.email).toBe("user@gmail.com");
    });

    it("returns unlinked status", async () => {
      const token = makeToken({ id: 1 });
      supabase.from.mockReturnValue(mockQuery({
        google_id: null,
        google_linked: false,
        google_email: null,
        google_name: null,
        google_picture: null,
        google_verified: false,
        google_linked_at: null,
      }));

      const res = await request(app)
        .get("/api/auth/google/status")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.linked).toBe(false);
      expect(res.body.googleSub).toBeNull();
    });
  });
});
