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
  in: function () { return this; },
  order: function () { return this; },
  limit: function () { return this; },
  not: function () { return this; },
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

const activeEvent = {
  id: 1,
  title: "Workshop",
  date: "2026-01-01T10:00:00Z",
  image: "img.jpg",
  latitude: 10,
  longitude: 20,
  radius: 100,
  is_active: true,
};

function queryFor(data, error = null) {
  return { ...mockQuery, _data: data, _error: error };
}

function eventsChain(event) {
  return {
    ...mockQuery,
    _data: event,
    eq: () => ({ ...mockQuery, _data: event, maybeSingle: async () => ({ data: event, error: null }) }),
    maybeSingle: async () => ({ data: event, error: null }),
  };
}

function attendanceChain(existing, inserted) {
  return {
    ...mockQuery,
    _data: existing,
    eq: () => ({ ...mockQuery, _data: existing, eq: () => ({ ...mockQuery, _data: existing, single: async () => ({ data: existing, error: null }) }) }),
    single: async () => ({ data: existing, error: null }),
    maybeSingle: async () => ({ data: existing, error: null }),
    insert: () => ({ ...mockQuery, _data: inserted, select: () => ({ ...mockQuery, _data: inserted, single: async () => ({ data: inserted, error: null }) }) }),
    update: () => mockQuery,
  };
}

describe("Event-based Zone Attendance", () => {
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/attendance", attendanceRoutes);
  });

  beforeEach(() => { vi.clearAllMocks(); mockQuery._reset(null, null); });

  describe("GET /api/attendance/zone/status", () => {
    it("requires auth", async () => {
      const res = await request(app).get("/api/attendance/zone/status?latitude=10&longitude=20");
      expect(res.status).toBe(401);
    });

    it("rejects invalid coordinates", async () => {
      const res = await request(app)
        .get("/api/attendance/zone/status?latitude=abc&longitude=20")
        .set("Authorization", `Bearer ${memberToken}`);
      expect(res.status).toBe(400);
    });

    it("returns no event when no active event configured", async () => {
      supabase.from.mockImplementation((table) => {
        if (table === "events") return queryFor(null);
        return queryFor([]);
      });

      const res = await request(app)
        .get("/api/attendance/zone/status?latitude=10&longitude=20")
        .set("Authorization", `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
      expect(res.body.event).toBeNull();
      expect(res.body.inside).toBe(false);
      expect(res.body.alreadyCheckedIn).toBe(false);
    });

    it("returns no event when the active event has no location", async () => {
      supabase.from.mockImplementation((table) => {
        if (table === "events") return queryFor({ ...activeEvent, latitude: null, longitude: null });
        return queryFor([]);
      });

      const res = await request(app)
        .get("/api/attendance/zone/status?latitude=10&longitude=20")
        .set("Authorization", `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
      expect(res.body.event).toBeNull();
      expect(res.body.inside).toBe(false);
    });

    it("reports inside with event when user is within the event radius", async () => {
      supabase.from.mockImplementation((table) => {
        if (table === "events") return queryFor(activeEvent);
        if (table === "attendance") return queryFor({ id: 10 });
        return queryFor([]);
      });

      const res = await request(app)
        .get("/api/attendance/zone/status?latitude=10.0005&longitude=20")
        .set("Authorization", `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
      expect(res.body.event.id).toBe(1);
      expect(res.body.event.title).toBe("Workshop");
      expect(res.body.event.latitude).toBe(10);
      expect(res.body.event.radius).toBe(100);
      expect(res.body.inside).toBe(true);
      expect(res.body.alreadyCheckedIn).toBe(true);
    });

    it("reports not checked in when no attendance record", async () => {
      supabase.from.mockImplementation((table) => {
        if (table === "events") return queryFor(activeEvent);
        if (table === "attendance") return queryFor(null);
        return queryFor([]);
      });

      const res = await request(app)
        .get("/api/attendance/zone/status?latitude=10&longitude=20")
        .set("Authorization", `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
      expect(res.body.inside).toBe(true);
      expect(res.body.alreadyCheckedIn).toBe(false);
    });

    it("reports outside when user is beyond the event radius", async () => {
      supabase.from.mockImplementation((table) => {
        if (table === "events") return queryFor(activeEvent);
        return queryFor([]);
      });

      const res = await request(app)
        .get("/api/attendance/zone/status?latitude=20&longitude=20")
        .set("Authorization", `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
      expect(res.body.event.id).toBe(1);
      expect(res.body.inside).toBe(false);
      expect(res.body.distance).toBeGreaterThan(0);
      expect(res.body.alreadyCheckedIn).toBe(false);
    });
  });

  describe("POST /api/attendance with event location", () => {
    it("rejects check-in when event is not active", async () => {
      const event = { ...activeEvent, is_active: false };
      supabase.from.mockImplementation((table) => {
        if (table === "events") return eventsChain(event);
        return queryFor(null);
      });

      const res = await request(app)
        .post("/api/attendance/")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ memberId: 1, eventId: 1, latitude: 10, longitude: 20 });
      expect(res.status).toBe(403);
    });

    it("requires latitude and longitude when the event has a location", async () => {
      supabase.from.mockImplementation((table) => {
        if (table === "events") return eventsChain(activeEvent);
        return queryFor(null);
      });

      const res = await request(app)
        .post("/api/attendance/")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ memberId: 1, eventId: 1 });
      expect(res.status).toBe(400);
    });

    it("rejects invalid coordinates", async () => {
      supabase.from.mockImplementation((table) => {
        if (table === "events") return eventsChain(activeEvent);
        return queryFor(null);
      });

      const res = await request(app)
        .post("/api/attendance/")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ memberId: 1, eventId: 1, latitude: 200, longitude: 20 });
      expect(res.status).toBe(400);
    });

    it("rejects member outside event radius", async () => {
      supabase.from.mockImplementation((table) => {
        if (table === "events") return eventsChain(activeEvent);
        return queryFor(null);
      });

      const res = await request(app)
        .post("/api/attendance/")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ memberId: 1, eventId: 1, latitude: 30, longitude: 20 });
      expect(res.status).toBe(403);
      expect(res.body.distance).toBeGreaterThan(0);
      expect(res.body.radius).toBe(100);
    });

    it("registers attendance when inside the event radius and event active", async () => {
      supabase.from.mockImplementation((table) => {
        if (table === "events") return eventsChain(activeEvent);
        if (table === "attendance") return attendanceChain(null, { id: 10 });
        return queryFor(null);
      });

      const res = await request(app)
        .post("/api/attendance/")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ memberId: 1, eventId: 1, latitude: 10, longitude: 20, location: "Near gate" });
      expect(res.status).toBe(200);
      expect(res.body.pointsAwarded).toBe(2);
      expect(res.body.newBalance).toBe(4);
    });

    it("allows legacy check-in when the event has no location", async () => {
      const event = { id: 2, title: "Legacy Event", latitude: null, longitude: null, is_active: true };
      supabase.from.mockImplementation((table) => {
        if (table === "events") return eventsChain(event);
        if (table === "attendance") return attendanceChain(null, { id: 11 });
        return queryFor(null);
      });

      const res = await request(app)
        .post("/api/attendance/")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ memberId: 1, eventId: 2 });
      expect(res.status).toBe(200);
      expect(res.body.pointsAwarded).toBe(2);
    });

    it("still rejects duplicates", async () => {
      supabase.from.mockImplementation((table) => {
        if (table === "events") return eventsChain(activeEvent);
        if (table === "attendance") return attendanceChain({ id: 99 }, null);
        return queryFor(null);
      });

      const res = await request(app)
        .post("/api/attendance/")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ memberId: 1, eventId: 1, latitude: 10, longitude: 20 });
      expect(res.status).toBe(409);
    });
  });
});
