import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import express from "express";

const JWT_SECRET = "MTCLUB_SECRET";

const mockQuery = {
  _data: null, _error: null,
  select: function () { return this; },
  insert: function () { return this; },
  update: function () { return this; },
  delete: function () { return this; },
  eq: function () { return this; },
  order: function () { return this; },
  single: async function () { return { data: this._data, error: this._error }; },
  maybeSingle: async function () { return { data: this._data, error: this._error }; },
  then: function (resolve) { return Promise.resolve({ data: this._data, error: this._error }).then(resolve); },
  _reset(d = null, e = null) { this._data = d; this._error = e; },
};

vi.mock("../../config/supabase.js", () => ({
  supabase: { from: vi.fn(() => mockQuery) },
}));
vi.mock("../../utils/storage.js", () => ({
  createMulter: vi.fn(() => ({ single: () => (req, res, next) => next() })),
  saveUpload: vi.fn().mockResolvedValue(undefined),
  deleteUpload: vi.fn().mockResolvedValue(undefined),
  getPublicUrl: vi.fn().mockReturnValue("https://storage.example.com/test.jpg"),
  ensureBucket: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../utils/points.js", () => ({
  calculateUserPoints: vi.fn().mockResolvedValue({ total: 0 }),
  calculateLeaderboard: vi.fn().mockResolvedValue([]),
}));

import adminRoutes from "../../routes/admin.js";
import { supabase } from "../../config/supabase.js";

let app;
const adminToken = jwt.sign({ id: 1, role: "admin" }, JWT_SECRET, { expiresIn: "1h" });
const leaderToken = jwt.sign({ id: 2, role: "leader" }, JWT_SECRET, { expiresIn: "1h" });
const memberToken = jwt.sign({ id: 3, role: "member" }, JWT_SECRET, { expiresIn: "1h" });

describe("Admin Routes", () => {
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/admin", adminRoutes);
  });

  beforeEach(() => { vi.clearAllMocks(); mockQuery._reset(null, null); });

  describe("GET /api/admin/members", () => {
    it("requires leader or admin auth", async () => {
      const res = await request(app)
        .get("/api/admin/members")
        .set("Authorization", `Bearer ${memberToken}`);
      expect(res.status).toBe(403);
    });

    it("returns members list for admin", async () => {
      const members = [{ id: 1, name: "Test", email: "t@t.com", role: "member" }];
      supabase.from.mockReturnValue({ ...mockQuery, _data: members });

      const res = await request(app)
        .get("/api/admin/members")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("returns members list for leader", async () => {
      supabase.from.mockReturnValue({ ...mockQuery, _data: [] });

      const res = await request(app)
        .get("/api/admin/members")
        .set("Authorization", `Bearer ${leaderToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/admin/members", () => {
    it("requires admin auth", async () => {
      const res = await request(app)
        .post("/api/admin/members")
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ name: "New", email: "n@n.com", tempPassword: "pass123" });
      expect(res.status).toBe(403);
    });

    it("validates required fields", async () => {
      const res = await request(app)
        .post("/api/admin/members")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "New" });
      expect(res.status).toBe(400);
    });

    it("validates password length", async () => {
      const res = await request(app)
        .post("/api/admin/members")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "New", email: "n@n.com", tempPassword: "12345" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/6 characters/i);
    });

    it("creates member successfully", async () => {
      const insertResult = { id: 5, name: "New", email: "new@n.com", role: "member" };
      supabase.from.mockReturnValue({
        ...mockQuery, _data: insertResult,
        insert: () => ({ ...mockQuery, _data: insertResult, select: () => ({ ...mockQuery, _data: insertResult, single: async () => ({ data: insertResult, error: null }) }) }),
      });

      const res = await request(app)
        .post("/api/admin/members")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "New", email: "new@n.com", tempPassword: "password123", role: "member" });
      expect(res.status).toBe(200);
    });
  });

  describe("PUT /api/admin/members/:id/toggle", () => {
    it("toggles member enabled status", async () => {
      supabase.from.mockImplementation((table) => {
        if (table === "members") {
          return {
            ...mockQuery,
            _data: { enabled: 1 },
            select: () => ({ ...mockQuery, _data: { enabled: 1 }, eq: () => ({ ...mockQuery, _data: { enabled: 1 }, single: async () => ({ data: { enabled: 1 }, error: null }) }) }),
            eq: () => ({ ...mockQuery, _data: { enabled: 1 } }),
            update: () => mockQuery,
          };
        }
        return mockQuery;
      });

      const res = await request(app)
        .put("/api/admin/members/1/toggle")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /api/admin/members/:id", () => {
    it("requires admin auth", async () => {
      const res = await request(app)
        .delete("/api/admin/members/1")
        .set("Authorization", `Bearer ${leaderToken}`);
      expect(res.status).toBe(403);
    });

    it("deletes member", async () => {
      supabase.from.mockReturnValue({ ...mockQuery, _data: null, eq: () => mockQuery, delete: () => ({ ...mockQuery, _data: null, eq: () => mockQuery }) });

      const res = await request(app)
        .delete("/api/admin/members/1")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });
});
