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
  getPublicUrl: vi.fn().mockReturnValue("https://storage.example.com/event.jpg"),
  deleteUpload: vi.fn().mockResolvedValue(undefined),
  ensureBucket: vi.fn().mockResolvedValue(undefined),
}));

import eventsRoutes from "../../routes/events.js";
import { supabase } from "../../config/supabase.js";

let app;
const adminToken = jwt.sign({ id: 1, role: "admin" }, JWT_SECRET, { expiresIn: "1h" });

describe("Events Routes", () => {
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/events", eventsRoutes);
  });

  beforeEach(() => { vi.clearAllMocks(); mockQuery._reset(null, null); });

  describe("GET /api/events/", () => {
    it("returns events list", async () => {
      const events = [{ id: 1, title: "Test Event" }];
      const chain = { ...mockQuery, _data: events };
      supabase.from.mockReturnValue(chain);

      const res = await request(app).get("/api/events/");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("returns empty array when no events", async () => {
      const chain = { ...mockQuery, _data: [] };
      supabase.from.mockReturnValue(chain);

      const res = await request(app).get("/api/events/");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("GET /api/events/:id", () => {
    it("returns single event", async () => {
      const event = { id: 1, title: "Event 1" };
      const chain = { ...mockQuery, _data: event };
      supabase.from.mockReturnValue(chain);

      const res = await request(app).get("/api/events/1");
      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Event 1");
    });

    it("returns 404 for missing event", async () => {
      const chain = { ...mockQuery, _data: null, _error: { message: "not found" } };
      supabase.from.mockReturnValue(chain);

      const res = await request(app).get("/api/events/999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/events/", () => {
    it("requires admin auth", async () => {
      const res = await request(app)
        .post("/api/events/")
        .send({ title: "New Event" });
      expect(res.status).toBe(401);
    });

    it("creates event with admin token", async () => {
      const insertChain = { ...mockQuery, _data: { id: 1, image: "" } };
      supabase.from.mockReturnValue(insertChain);

      const res = await request(app)
        .post("/api/events/")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "New Event", description: "A test event" });
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
    });
  });
});
