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
  createMulter: vi.fn(() => ({
    single: () => (req, res, next) => {
      if (req.headers["content-type"]?.includes("multipart")) {
        req.file = { originalname: "test.jpg", mimetype: "image/jpeg", buffer: Buffer.from("fake"), size: 4 };
      }
      next();
    },
  })),
  saveUpload: vi.fn().mockResolvedValue(undefined),
  deleteUpload: vi.fn().mockResolvedValue(undefined),
  getPublicUrl: vi.fn().mockReturnValue("https://storage.example.com/gallery.jpg"),
  ensureBucket: vi.fn().mockResolvedValue(undefined),
}));

import galleryRoutes from "../../routes/gallery.js";
import { supabase } from "../../config/supabase.js";

let app;
const adminToken = jwt.sign({ id: 1, role: "admin" }, JWT_SECRET, { expiresIn: "1h" });
const leaderToken = jwt.sign({ id: 2, role: "leader" }, JWT_SECRET, { expiresIn: "1h" });
const memberToken = jwt.sign({ id: 3, role: "member" }, JWT_SECRET, { expiresIn: "1h" });

describe("Gallery Routes", () => {
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/gallery", galleryRoutes);
  });

  beforeEach(() => { vi.clearAllMocks(); mockQuery._reset(null, null); });

  describe("GET /api/gallery/", () => {
    it("returns gallery items", async () => {
      const items = [{ id: 1, filename: "test.jpg", created_at: "2024-01-01" }];
      supabase.from.mockReturnValue({ ...mockQuery, _data: items });

      const res = await request(app).get("/api/gallery/");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("returns empty array for no images", async () => {
      supabase.from.mockReturnValue({ ...mockQuery, _data: [] });

      const res = await request(app).get("/api/gallery/");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("POST /api/gallery/", () => {
    it("requires leader or admin auth", async () => {
      const res = await request(app)
        .post("/api/gallery/")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it("allows leader to upload", async () => {
      const result = { id: 1, filename: "https://storage.example.com/gallery.jpg" };
      const insertChain = {
        ...mockQuery,
        _data: result,
        insert: function() {
          const self = {
            ...mockQuery,
            _data: result,
            select: function() {
              return {
                ...mockQuery,
                _data: result,
                single: function() { return Promise.resolve({ data: result, error: null }); },
              };
            },
          };
          return self;
        },
      };
      supabase.from.mockReturnValue(insertChain);

      const res = await request(app)
        .post("/api/gallery/")
        .set("Authorization", `Bearer ${leaderToken}`)
        .set("Content-Type", "multipart/form-data; boundary=----formdata")
        .attach("image", Buffer.from("fake image data"), "test.jpg");
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /api/gallery/:id", () => {
    it("requires admin auth", async () => {
      const res = await request(app)
        .delete("/api/gallery/1")
        .set("Authorization", `Bearer ${leaderToken}`);
      expect(res.status).toBe(403);
    });

    it("deletes gallery item", async () => {
      supabase.from.mockReturnValue({
        ...mockQuery,
        _data: { image_url: "https://example.com/img.jpg" },
        eq: () => ({ ...mockQuery, _data: { image_url: "https://example.com/img.jpg" }, single: async () => ({ data: { image_url: "https://example.com/img.jpg" }, error: null }) }),
        delete: () => ({ ...mockQuery, _data: null, eq: () => mockQuery }),
      });

      const res = await request(app)
        .delete("/api/gallery/1")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });
});
