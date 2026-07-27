import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";

const JWT_SECRET = "MTCLUB_SECRET";

vi.mock("../../config/supabase.js", () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/test.jpg" } })),
        upload: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
}));

vi.mock("../../utils/storage.js", () => ({
  uploadToStorage: vi.fn().mockResolvedValue("https://storage.example.com/profile.jpg"),
  saveUpload: vi.fn().mockResolvedValue(undefined),
  deleteUpload: vi.fn().mockResolvedValue(undefined),
  getPublicUrl: vi.fn().mockReturnValue("https://storage.example.com/test.jpg"),
  createMulter: vi.fn(() => ({ single: () => (req, res, next) => next() })),
  ensureBucket: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/points.js", () => ({
  calculateUserPoints: vi.fn().mockResolvedValue({ total: 0, attendanceCount: 0, attendancePoints: 0, adjustmentPoints: 0, adjustmentHistory: [] }),
  calculateLeaderboard: vi.fn().mockResolvedValue([]),
}));

vi.mock("bcryptjs", async () => {
  const actual = await vi.importActual("bcryptjs");
  return { ...actual, default: actual };
});

import express from "express";
import bcrypt from "bcryptjs";
import authRoutes from "../../routes/auth.js";
import { supabase } from "../../config/supabase.js";

let app;

function makeToken(payload) {
  return jwt.sign({ id: 1, role: "member", ...payload }, JWT_SECRET, { expiresIn: "1h" });
}

function mockQuery(data = null, error = null) {
  const q = {
    _data: data,
    _error: error,
    select: function () { return this; },
    insert: function () { return this; },
    update: function () { return this; },
    delete: function () { return this; },
    eq: function () { return this; },
    neq: function () { return this; },
    ilike: function () { return this; },
    in: function () { return this; },
    order: function () { return this; },
    limit: function () { return this; },
    single: function () { return Promise.resolve({ data: this._data, error: this._error }); },
    maybeSingle: function () { return Promise.resolve({ data: this._data, error: this._error }); },
    upsert: function () { return this; },
    then: function (resolve, reject) {
      return Promise.resolve({ data: this._data, error: this._error }).then(resolve, reject);
    },
  };
  return q;
}

describe("Auth Routes", () => {
  beforeAll(() => {
    app = express();
    app.use(express.json({ limit: "5mb" }));
    app.use("/api/auth", authRoutes);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReturnValue(mockQuery());
  });

  describe("POST /api/auth/register", () => {
    it("registers successfully", async () => {
      supabase.from.mockReturnValue(mockQuery([]));

      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "Test User", email: "test@example.com", password: "password123" });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/registered/i);
    });

    it("rejects duplicate email", async () => {
      supabase.from.mockReturnValue(mockQuery([{ id: 1 }]));

      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "Test", email: "existing@example.com", password: "password123" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/exists/i);
    });

    it("rejects missing fields", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "a@b.com" });
      expect(res.status).toBe(400);
    });

    it("rejects short password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "Test", email: "test@example.com", password: "12345" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/6 characters/i);
    });
  });

  describe("POST /api/auth/login", () => {
    it("logs in successfully", async () => {
      const hashedPw = await bcrypt.hash("password123", 10);
      const userData = [{ id: 1, name: "Test", email: "test@test.com", role: "member", enabled: 1, password: hashedPw, profile_image: "", committee: null }];
      supabase.from.mockReturnValue(mockQuery(userData));

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@test.com", password: "password123" });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.name).toBe("Test");
    });

    it("rejects wrong password", async () => {
      const hashedPw = await bcrypt.hash("correct", 10);
      supabase.from.mockReturnValue(mockQuery([{ id: 1, email: "t@t.com", role: "member", enabled: 1, password: hashedPw, name: "T", profile_image: "", committee: null }]));

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "t@t.com", password: "wrong" });
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid/i);
    });

    it("rejects non-existent user", async () => {
      supabase.from.mockReturnValue(mockQuery([]));

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@test.com", password: "pass" });
      expect(res.status).toBe(401);
    });

    it("rejects disabled user", async () => {
      const hashedPw = await bcrypt.hash("pass", 10);
      supabase.from.mockReturnValue(mockQuery([{ id: 2, name: "D", email: "d@t.com", role: "member", enabled: 0, password: hashedPw, profile_image: "", committee: null }]));

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "d@t.com", password: "pass" });
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid/i);
    });

    it("rejects missing email or password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "a@b.com" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/auth/profile", () => {
    it("returns profile with valid token", async () => {
      const token = makeToken({ id: 1 });
      supabase.from.mockReturnValue(mockQuery({ id: 1, name: "Test", email: "t@t.com", role: "member", profile_image: "", committee: null }));

      const res = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Test");
    });

    it("returns 401 with invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", "Bearer badtoken");
      expect(res.status).toBe(401);
    });

    it("returns 401 without token", async () => {
      const res = await request(app).get("/api/auth/profile");
      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/auth/change-password", () => {
    it("changes password successfully", async () => {
      const token = makeToken({ id: 1 });
      const hashedPw = await bcrypt.hash("oldpass", 10);
      supabase.from.mockReturnValue(mockQuery([{ password: hashedPw }]));

      const res = await request(app)
        .put("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ oldPassword: "oldpass", newPassword: "newpass123" });
      expect(res.status).toBe(200);
    });

    it("rejects wrong old password", async () => {
      const token = makeToken({ id: 1 });
      const hashedPw = await bcrypt.hash("correct", 10);
      supabase.from.mockReturnValue(mockQuery([{ password: hashedPw }]));

      const res = await request(app)
        .put("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ oldPassword: "wrong", newPassword: "newpass123" });
      expect(res.status).toBe(400);
    });

    it("rejects short new password", async () => {
      const token = makeToken({ id: 1 });
      const res = await request(app)
        .put("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ oldPassword: "old", newPassword: "12345" });
      expect(res.status).toBe(400);
    });
  });
});
