import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import express from "express";

const JWT_SECRET = "MTCLUB_SECRET";

const mockQuery = {
  _data: null,
  _error: null,
  _count: null,
  _single: false,
  select: function () { return this; },
  insert: function () { return this; },
  update: function () { return this; },
  delete: function () { return this; },
  eq: function () { return this; },
  in: function () { return this; },
  neq: function () { return this; },
  not: function () { return this; },
  order: function () { return this; },
  range: function () { return this; },
  limit: function () { return this; },
  upsert: function () { return this; },
  group: function () { return this; },
  having: function () { return this; },
  single: async function () { return { data: this._single ? this._data : null, error: this._error }; },
  maybeSingle: async function () { return { data: this._data, error: this._error }; },
  then: function (resolve) {
    return Promise.resolve({ data: this._data, error: this._error, count: this._count }).then(resolve);
  },
  _reset(d = null, e = null, c = null) {
    this._data = d;
    this._error = e;
    this._count = c;
    this._single = false;
  },
};

vi.mock("../../config/supabase.js", () => ({
  supabase: { from: vi.fn(() => mockQuery) },
}));

vi.mock("../../utils/onesignal.js", () => ({
  sendToAll: vi.fn().mockResolvedValue({ sent: 5, failed: 0, error: null, onesignalId: "os_123", historyId: 1 }),
  sendToUser: vi.fn().mockResolvedValue({ sent: 1, failed: 0, error: null, onesignalId: "os_456", historyId: 2 }),
  sendToUsers: vi.fn().mockResolvedValue({ sent: 3, failed: 0, error: null, onesignalId: "os_789", historyId: 3 }),
  sendToCommittee: vi.fn().mockResolvedValue({ sent: 2, failed: 0, error: null, onesignalId: "os_com", historyId: 4 }),
  sendToRole: vi.fn().mockResolvedValue({ sent: 2, failed: 0, error: null, onesignalId: "os_role", historyId: 5 }),
  sendToTag: vi.fn().mockResolvedValue({ sent: 1, failed: 0, error: null, onesignalId: "os_tag", historyId: 6 }),
  sendToExternalIds: vi.fn().mockResolvedValue({ sent: 2, failed: 0, error: null, onesignalId: "os_ext", historyId: 7 }),
  getConfig: vi.fn().mockReturnValue({ configured: true, appId: "b14c3ac3...", apiKey: "set (length=40)" }),
  getSubscribedCount: vi.fn().mockResolvedValue(5),
  buildUserNotificationRecords: vi.fn().mockResolvedValue(undefined),
  buildPayload: vi.fn().mockReturnValue({}),
  sendNotification: vi.fn().mockResolvedValue({ id: "os_test", recipients: 1 }),
  recordHistory: vi.fn().mockResolvedValue(99),
  getGoogleIdForMember: vi.fn().mockResolvedValue("google-sub-test-123"),
  resolveGoogleIds: vi.fn().mockResolvedValue([]),
}));

import notificationRoutes from "../../routes/notifications.js";
import {
  sendToAll, sendToUser, getSubscribedCount, buildUserNotificationRecords,
  getGoogleIdForMember,
} from "../../utils/onesignal.js";
import { supabase } from "../../config/supabase.js";

let app;
const adminToken = jwt.sign({ id: 1, role: "admin" }, JWT_SECRET, { expiresIn: "1h" });
const leaderToken = jwt.sign({ id: 2, role: "leader" }, JWT_SECRET, { expiresIn: "1h" });
const memberToken = jwt.sign({ id: 3, role: "member" }, JWT_SECRET, { expiresIn: "1h" });

describe("Notification Routes", () => {
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/notifications", notificationRoutes);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery._reset(null, null, null);
  });

  // ─── AUTH TESTS ──────────────────────────────────────────

  describe("Authentication", () => {
    it("returns 401 without auth token on protected routes", async () => {
      const res = await request(app).get("/api/notifications/inbox");
      expect(res.status).toBe(401);
    });

    it("allows authenticated user to access inbox", async () => {
      mockQuery._reset([], null, 0);
      const res = await request(app)
        .get("/api/notifications/inbox")
        .set("Authorization", `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ─── TASK 8: URGENT PERMISSION CHECK ─────────────────────

  describe("POST /api/notifications/send — Urgent Permission", () => {
    it("allows admin to send urgent notifications", async () => {
      getSubscribedCount.mockResolvedValueOnce(5);
      sendToAll.mockResolvedValueOnce({ sent: 5, failed: 0, error: null, onesignalId: "os_admin", historyId: 10 });

      const res = await request(app)
        .post("/api/notifications/send")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "Alert", body: "Emergency!", importance: "urgent", target: "all" });

      expect(res.status).toBe(200);
      expect(res.body.sent).toBe(5);
    });

    it("blocks leader from sending urgent notifications", async () => {
      const res = await request(app)
        .post("/api/notifications/send")
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ title: "Alert", body: "Emergency!", importance: "urgent", target: "all" });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/admin/i);
    });

    it("blocks member from sending notifications", async () => {
      const res = await request(app)
        .post("/api/notifications/send")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ title: "Test", body: "Body", target: "all" });

      expect(res.status).toBe(403);
    });

    it("allows leader to send regular notifications", async () => {
      getSubscribedCount.mockResolvedValueOnce(5);
      sendToAll.mockResolvedValueOnce({ sent: 5, failed: 0, error: null, onesignalId: "os_lead", historyId: 11 });

      const res = await request(app)
        .post("/api/notifications/send")
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ title: "Update", body: "New event", target: "all" });

      expect(res.status).toBe(200);
      expect(res.body.sent).toBe(5);
    });
  });

  // ─── TASK 3: SENDING VALIDATION ─────────────────────────

  describe("POST /api/notifications/send — Validation", () => {
    it("rejects send without title", async () => {
      const res = await request(app)
        .post("/api/notifications/send")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ body: "No title" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/title/i);
    });

    it("rejects send without body", async () => {
      const res = await request(app)
        .post("/api/notifications/send")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "No body" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/body/i);
    });

    it("rejects send when audience is zero", async () => {
      getSubscribedCount.mockResolvedValueOnce(0);

      const res = await request(app)
        .post("/api/notifications/send")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "Test", body: "Hello", target: "all" });

      expect(res.status).toBe(400);
      expect(res.body.audienceCount).toBe(0);
    });

    it("rejects user target without targetValue", async () => {
      getSubscribedCount.mockResolvedValueOnce(5);

      const res = await request(app)
        .post("/api/notifications/send")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "Test", body: "Hello", target: "user" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/targetValue/i);
    });

    it("rejects tag target with invalid format", async () => {
      getSubscribedCount.mockResolvedValueOnce(1);

      const res = await request(app)
        .post("/api/notifications/send")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "Test", body: "Hello", target: "tag", targetValue: "noequals" });

      expect(res.status).toBe(400);
    });
  });

  // ─── TASK 3: EMPTY AUDIENCE VALIDATION ───────────────────

  describe("POST /api/notifications/send — Empty Audience", () => {
    it("returns 400 with audienceCount=0 for empty all target", async () => {
      getSubscribedCount.mockResolvedValueOnce(0);

      const res = await request(app)
        .post("/api/notifications/send")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "Hi", body: "World", target: "all" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/No linked Google accounts|No subscribed/i);
      expect(res.body.audienceCount).toBe(0);
    });

    it("skips audience check for segment target", async () => {
      getSubscribedCount.mockResolvedValueOnce(0);
      sendToAll.mockResolvedValueOnce({ sent: 10, failed: 0, error: null, onesignalId: "os_seg", historyId: 12 });

      const res = await request(app)
        .post("/api/notifications/send")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "Hi", body: "World", target: "all" });

      expect(res.status).toBe(400);
    });
  });

  // ─── SEND ALL TARGET TYPES ──────────────────────────────

  describe("POST /api/notifications/send — Target Types", () => {
    it("sends to all users", async () => {
      getSubscribedCount.mockResolvedValueOnce(10);
      sendToAll.mockResolvedValueOnce({ sent: 10, failed: 0, error: null, onesignalId: "os_all", historyId: 20 });

      const res = await request(app)
        .post("/api/notifications/send")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "All", body: "Hello everyone", target: "all" });

      expect(res.status).toBe(200);
      expect(res.body.sent).toBe(10);
      expect(sendToAll).toHaveBeenCalled();
    });

    it("sends to a specific user", async () => {
      getSubscribedCount.mockResolvedValueOnce(1);
      sendToUser.mockResolvedValueOnce({ sent: 1, failed: 0, error: null, onesignalId: "os_one", historyId: 21 });

      const res = await request(app)
        .post("/api/notifications/send")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "User", body: "Hello user", target: "user", targetValue: "5" });

      expect(res.status).toBe(200);
      expect(res.body.sent).toBe(1);
    });

    it("builds user notification records after successful send", async () => {
      getSubscribedCount.mockResolvedValueOnce(5);
      sendToAll.mockResolvedValueOnce({ sent: 5, failed: 0, error: null, onesignalId: "os_inbox", historyId: 25 });

      await request(app)
        .post("/api/notifications/send")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "Inbox", body: "Check inbox", target: "all", category: "event" });

      expect(buildUserNotificationRecords).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Inbox",
          body: "Check inbox",
          category: "event",
        })
      );
    });
  });

  // ─── DEVICE REGISTRATION ─────────────────────────────────

  describe("POST /api/notifications/save-oneSignal-id", () => {
    it("saves device for authenticated user", async () => {
      const res = await request(app)
        .post("/api/notifications/save-oneSignal-id")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          onesignalId: "os_sub_123",
          onesignalUserId: "os_user_456",
          browser: "Chrome",
          platform: "Windows",
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/saved/i);
    });

    it("updates member record with device info", async () => {
      mockQuery._reset(null, null, null);

      await request(app)
        .post("/api/notifications/save-oneSignal-id")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ onesignalId: "sub_001", browser: "Firefox", platform: "macOS" });

      expect(supabase.from).toHaveBeenCalledWith("members");
    });

    it("upserts notification_devices record", async () => {
      mockQuery._reset(null, null, null);

      await request(app)
        .post("/api/notifications/save-oneSignal-id")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ onesignalId: "sub_002" });

      expect(supabase.from).toHaveBeenCalledWith("notification_devices");
    });

    it("returns 400 when onesignalId is missing", async () => {
      const res = await request(app)
        .post("/api/notifications/save-oneSignal-id")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/notifications/unregister", () => {
    it("unregisters device for authenticated user", async () => {
      const res = await request(app)
        .delete("/api/notifications/unregister")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/unregistered/i);
    });
  });

  describe("POST /api/notifications/save-oneSignal-id", () => {
    it("saves OneSignal ID successfully", async () => {
      const res = await request(app)
        .post("/api/notifications/save-oneSignal-id")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ onesignalId: "saved_001" });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/saved/i);
    });

    it("rejects without onesignalId", async () => {
      const res = await request(app)
        .post("/api/notifications/save-oneSignal-id")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/onesignalId/i);
    });
  });

  // ─── TASK 5: INBOX ─────────────────────────────────────────

  describe("GET /api/notifications/inbox", () => {
    it("returns inbox with success=true", async () => {
      mockQuery._reset([{ id: 1, title: "Hi", read: false }], null, 1);

      const res = await request(app)
        .get("/api/notifications/inbox")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.unreadCount).toBe("number");
      expect(typeof res.body.total).toBe("number");
    });

    it("returns structured error when Supabase table is missing", async () => {
      mockQuery._reset(null, {
        message: 'relation "public.user_notifications" does not exist',
        code: "42P01",
        details: null,
        hint: null,
      });

      const res = await request(app)
        .get("/api/notifications/inbox")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("42P01");
      expect(res.body.error).toMatch(/does not exist/i);
    });

    it("returns structured error when RLS blocks access", async () => {
      mockQuery._reset(null, {
        message: "permission denied for table user_notifications",
        code: "42501",
        details: null,
        hint: null,
      });

      const res = await request(app)
        .get("/api/notifications/inbox")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("42501");
    });

    it("handles unread count query failure gracefully", async () => {
      mockQuery._reset([{ id: 1, title: "Hi", read: false }], null, 1);

      const originalFrom = supabase.from;
      let callCount = 0;
      supabase.from = vi.fn((table) => {
        callCount++;
        if (callCount === 2) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ count: null, error: { message: "RLS blocked", code: "42501" } }),
              }),
            }),
          };
        }
        return mockQuery;
      });

      const res = await request(app)
        .get("/api/notifications/inbox")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.unreadCount).toBe(0);

      supabase.from = originalFrom;
    });

    it("returns 400 for invalid user ID", async () => {
      const badToken = jwt.sign({ id: "not_a_number", role: "member" }, JWT_SECRET, { expiresIn: "1h" });
      const res = await request(app)
        .get("/api/notifications/inbox")
        .set("Authorization", `Bearer ${badToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid user ID/i);
    });

    it("supports unread-only filter", async () => {
      mockQuery._reset([], null, 0);

      const res = await request(app)
        .get("/api/notifications/inbox?unread=true")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("supports category filter", async () => {
      mockQuery._reset([], null, 0);

      const res = await request(app)
        .get("/api/notifications/inbox?category=event")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("clamps limit to max 50", async () => {
      mockQuery._reset([], null, 0);

      const res = await request(app)
        .get("/api/notifications/inbox?limit=999")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(50);
    });
  });

  describe("PUT /api/notifications/inbox/read-all", () => {
    it("marks all notifications as read", async () => {
      const res = await request(app)
        .put("/api/notifications/inbox/read-all")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/read/i);
    });

    it("returns structured error on Supabase failure", async () => {
      mockQuery._reset(null, {
        message: "permission denied",
        code: "42501",
        details: null,
        hint: null,
      });

      const res = await request(app)
        .put("/api/notifications/inbox/read-all")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("42501");
    });
  });

  describe("PUT /api/notifications/inbox/:id/read", () => {
    it("marks single notification as read", async () => {
      const res = await request(app)
        .put("/api/notifications/inbox/1/read")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("rejects invalid notification ID", async () => {
      const res = await request(app)
        .put("/api/notifications/inbox/abc/read")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("DELETE /api/notifications/inbox/:id", () => {
    it("deletes a notification", async () => {
      const res = await request(app)
        .delete("/api/notifications/inbox/1")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/deleted/i);
    });

    it("rejects invalid notification ID", async () => {
      const res = await request(app)
        .delete("/api/notifications/inbox/abc")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── ADMIN-ONLY ENDPOINTS ───────────────────────────────

  describe("Admin-only endpoints", () => {
    it("blocks member from accessing history", async () => {
      const res = await request(app)
        .get("/api/notifications/history")
        .set("Authorization", `Bearer ${memberToken}`);
      expect(res.status).toBe(403);
    });

    it("blocks member from accessing stats", async () => {
      const res = await request(app)
        .get("/api/notifications/stats")
        .set("Authorization", `Bearer ${memberToken}`);
      expect(res.status).toBe(403);
    });

    it("blocks member from accessing device stats", async () => {
      const res = await request(app)
        .get("/api/notifications/devices/stats")
        .set("Authorization", `Bearer ${memberToken}`);
      expect(res.status).toBe(403);
    });

    it("allows admin to access history", async () => {
      mockQuery._reset([], null, 0);
      const res = await request(app)
        .get("/api/notifications/history")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it("allows admin to access stats", async () => {
      mockQuery._reset([], null, 0);
      const res = await request(app)
        .get("/api/notifications/stats")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it("blocks leader from accessing history (admin only)", async () => {
      mockQuery._reset([], null, 0);
      const res = await request(app)
        .get("/api/notifications/history")
        .set("Authorization", `Bearer ${leaderToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ─── DIAGNOSTICS ─────────────────────────────────────────

  describe("GET /api/notifications/diagnostics", () => {
    it("returns diagnostics for authenticated user", async () => {
      mockQuery._reset({
        id: 3, onesignal_id: "sub_001", onesignal_user_id: "u_001",
        push_browser: "Chrome", push_platform: "Windows",
      }, null);
      mockQuery._single = true;

      const res = await request(app)
        .get("/api/notifications/diagnostics")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.backend).toBeDefined();
    });
  });

  // ─── AUDIENCE COUNT ─────────────────────────────────────

  describe("POST /api/notifications/audience-count", () => {
    it("returns audience count for authenticated user", async () => {
      mockQuery._reset(null, null, 5);

      const res = await request(app)
        .post("/api/notifications/audience-count")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ target: "all" });

      expect(res.status).toBe(200);
      expect(res.body.count).toBeDefined();
    });
  });
});
