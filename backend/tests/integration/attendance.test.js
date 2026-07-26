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
vi.mock("../../utils/points.js", () => ({
  calculateUserPoints: vi.fn().mockResolvedValue({ total: 4, attendanceCount: 2 }),
  calculateLeaderboard: vi.fn().mockResolvedValue([]),
}));

import attendanceRoutes from "../../routes/attendance.js";
import { supabase } from "../../config/supabase.js";

let app;
const memberToken = jwt.sign({ id: 1, role: "member" }, JWT_SECRET, { expiresIn: "1h" });
const member2Token = jwt.sign({ id: 2, role: "member" }, JWT_SECRET, { expiresIn: "1h" });

describe("Attendance Routes", () => {
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/attendance", attendanceRoutes);
  });

  beforeEach(() => { vi.clearAllMocks(); mockQuery._reset(null, null); });

  describe("POST /api/attendance/", () => {
    it("requires auth", async () => {
      const res = await request(app).post("/api/attendance/").send({ memberId: 1, eventId: 1 });
      expect(res.status).toBe(401);
    });

    it("registers attendance successfully", async () => {
      const event = { id: 1, title: "Event", latitude: null, longitude: null };
      const chain = {
        ...mockQuery,
        _data: event,
        _chainOrder: [],
        eq: function (col, val) {
          this._chainOrder.push({ col, val });
          if (this._chainOrder.length === 1 && !val) {
            this._data = event;
          }
          return this;
        },
      };

      let callCount = 0;
      supabase.from.mockImplementation((table) => {
        callCount++;
        if (table === "events") {
          return { ...mockQuery, _data: event, eq: () => ({ ...mockQuery, _data: event, maybeSingle: async () => ({ data: event, error: null }) }), maybeSingle: async () => ({ data: event, error: null }) };
        }
        if (table === "attendance") {
          return { ...mockQuery, _data: null, eq: () => ({ ...mockQuery, _data: null, eq: () => ({ ...mockQuery, _data: null, single: async () => ({ data: null, error: null }) }) }), single: async () => ({ data: null, error: null }), insert: () => ({ ...mockQuery, _data: { id: 1 }, select: () => ({ ...mockQuery, _data: { id: 1 }, single: async () => ({ data: { id: 1 }, error: null }) }) }), update: () => mockQuery };
        }
        return mockQuery;
      });

      const res = await request(app)
        .post("/api/attendance/")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ memberId: 1, eventId: 1, location: "Room 101" });
      expect(res.status).toBe(200);
    });

    it("rejects duplicate attendance", async () => {
      const event = { id: 1, title: "Event", latitude: null, longitude: null };
      supabase.from.mockImplementation((table) => {
        if (table === "events") {
          return { ...mockQuery, _data: event, eq: () => ({ ...mockQuery, _data: event, maybeSingle: async () => ({ data: event, error: null }) }), maybeSingle: async () => ({ data: event, error: null }) };
        }
        if (table === "attendance") {
          return { ...mockQuery, _data: { id: 99 }, eq: () => ({ ...mockQuery, _data: { id: 99 }, eq: () => ({ ...mockQuery, _data: { id: 99 }, single: async () => ({ data: { id: 99 }, error: null }) }) }), single: async () => ({ data: { id: 99 }, error: null }) };
        }
        return mockQuery;
      });

      const res = await request(app)
        .post("/api/attendance/")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ memberId: 1, eventId: 1 });
      expect(res.status).toBe(409);
    });

    it("validates event exists", async () => {
      supabase.from.mockImplementation((table) => {
        if (table === "events") {
          return { ...mockQuery, _data: null, eq: () => ({ ...mockQuery, _data: null, maybeSingle: async () => ({ data: null, error: null }) }), maybeSingle: async () => ({ data: null, error: null }) };
        }
        return mockQuery;
      });

      const res = await request(app)
        .post("/api/attendance/")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ memberId: 1, eventId: 999 });
      expect(res.status).toBe(404);
    });

    it("rejects memberId mismatch for member role", async () => {
      const res = await request(app)
        .post("/api/attendance/")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ memberId: 999, eventId: 1 });
      expect(res.status).toBe(403);
    });

    it("requires eventId or eventCode", async () => {
      const res = await request(app)
        .post("/api/attendance/")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ memberId: 1 });
      expect(res.status).toBe(400);
    });
  });
});
