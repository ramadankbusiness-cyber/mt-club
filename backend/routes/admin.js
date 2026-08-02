import express from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../config/supabase.js";
import { requireAdmin, requireLeaderOrAdmin } from "../middleware/role.js";
import path from "path";
import { createMulter, saveUpload, deleteUpload } from "../utils/storage.js";
import { calculateUserPoints, calculateLeaderboard } from "../utils/points.js";

const router = express.Router();

const upload = createMulter("members", (req, file, cb) => {
  const ext = path.extname(file.originalname) || ".png";
  cb(null, `member-${req.params.id}${ext}`);
});

router.get("/members", requireLeaderOrAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ message: "Server configuration error: database not connected" });
    }
    const { data, error } = await supabase
      .from("members")
      .select("id, name, email, role, department, academic_number, enabled, has_image, created_at")
      .order("id", { ascending: false });
    if (error) {
      return res.status(500).json({ message: "Failed to fetch members" });
    }
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch members" });
  }
});

router.post("/members", requireAdmin, async (req, res) => {
  const { name: rawName, email: rawEmail, role, committee, department, tempPassword, academicNumber } = req.body;
  const name = (rawName || "").trim().slice(0, 100);
  const email = (rawEmail || "").trim().toLowerCase().slice(0, 255);
  const sanitizedDept = (department || "").trim().slice(0, 100);
  const sanitizedAcademic = (academicNumber || "").trim().slice(0, 50);
  if (!name || !email || !tempPassword) return res.status(400).json({ message: "Name, email, and password required" });
  if (tempPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
  const validRoles = ["admin", "leader", "member"];
  const memberRole = validRoles.includes(role) ? role : "member";
  try {
    if (!supabase) return res.status(500).json({ message: "Server configuration error: database not connected" });
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const insertData = {
      name,
      email,
      password: hashedPassword,
      role: memberRole,
      department: sanitizedDept,
      academic_number: sanitizedAcademic,
    };
    const { data, error } = await supabase
      .from("members")
      .insert(insertData)
      .select("id, name, email, role, department, academic_number, enabled, has_image")
      .single();
    if (error) throw error;
    res.json({ id: data.id, name, email, role: memberRole, committee: committee || null, department: sanitizedDept, academicNumber: sanitizedAcademic, enabled: 1, has_image: 0 });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ message: "Email already exists" });
    res.status(500).json({ message: "Failed to create member" });
  }
});

router.put("/members/:id", requireAdmin, async (req, res) => {
  const { name: rawName, email: rawEmail, role, committee, department, academicNumber } = req.body;
  const validRoles = ["admin", "leader", "member"];
  const updateData = {};
  if (rawName !== undefined) updateData.name = (rawName || "").trim().slice(0, 100);
  if (rawEmail !== undefined) updateData.email = (rawEmail || "").trim().toLowerCase().slice(0, 255);
  if (role !== undefined && validRoles.includes(role)) updateData.role = role;
  if (department !== undefined) updateData.department = (department || "").trim().slice(0, 100);
  if (academicNumber !== undefined) updateData.academic_number = (academicNumber || "").trim().slice(0, 50);
  if (updateData.role === "leader" && committee) {
    updateData.committee = committee;
  } else if (updateData.role && updateData.role !== "leader") {
    updateData.committee = null;
  }
  try {
    if (!supabase) return res.status(500).json({ message: "Server configuration error: database not connected" });
    let { data, error } = await supabase
      .from("members")
      .update(updateData)
      .eq("id", req.params.id)
      .select("id, name, email, role, department, academic_number, enabled, has_image")
      .single();
    if (error && (error.code === "42703" || error.message?.includes("committee"))) {
      delete updateData.committee;
      ({ data, error } = await supabase
        .from("members")
        .update(updateData)
        .eq("id", req.params.id)
        .select("id, name, email, role, department, academic_number, enabled, has_image")
        .single());
    }
    if (error) throw error;
    res.json(data);
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ message: "Email already exists" });
    res.status(500).json({ message: "Failed to update member" });
  }
});

router.put("/members/:id/toggle", requireAdmin, async (req, res) => {
  try {
    const { data: member } = await supabase.from("members").select("enabled").eq("id", req.params.id).single();
    if (!member) return res.status(404).json({ message: "Member not found" });
    const newStatus = member.enabled ? 0 : 1;
    await supabase.from("members").update({ enabled: newStatus }).eq("id", req.params.id);
    res.json({ id: parseInt(req.params.id), enabled: newStatus });
  } catch (err) {
    res.status(500).json({ message: "Failed to toggle member" });
  }
});

router.delete("/members/:id", requireAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ message: "Server configuration error: database not connected" });
    const { error } = await supabase.from("members").delete().eq("id", req.params.id);
    if (error) throw error;
    for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
      await deleteUpload("members", `member-${req.params.id}${ext}`).catch(() => {});
    }
    res.json({ message: "Member deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete member" });
  }
});

router.post("/members/upload/:id", requireAdmin, (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) return res.status(400).json({ message: "Upload failed" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    try {
      await saveUpload(req.file, "members", req.file.filename);
      const { error: updateErr } = await supabase.from("members").update({ has_image: 1 }).eq("id", req.params.id);
      if (updateErr) {
        return res.status(500).json({ message: "Upload succeeded but failed to update record" });
      }
      res.json({ message: "Uploaded", filename: req.file.filename });
    } catch (e) {
      res.status(500).json({ message: "Upload failed" });
    }
  });
});

router.delete("/members/image/:id", requireAdmin, async (req, res) => {
  try {
    for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
      await deleteUpload("members", `member-${req.params.id}${ext}`);
    }
    await supabase.from("members").update({ has_image: 0 }).eq("id", req.params.id);
    res.json({ message: "Image removed" });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove image" });
  }
});

router.get("/events", requireLeaderOrAdmin, async (req, res) => {
  try {
    const { data: events, error: eventsErr } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: false });
    if (eventsErr) {
      return res.status(500).json({ message: "Failed to fetch events" });
    }

    const eventIds = (events || []).map(e => e.id);
    let counts = {};
    if (eventIds.length > 0) {
      const { data: rows, error: countsErr } = await supabase
        .from("attendance")
        .select("event_id")
        .in("event_id", eventIds);
      if (!countsErr && rows) {
        rows.forEach(r => { counts[r.event_id] = (counts[r.event_id] || 0) + 1; });
      }
    }

    const result = (events || []).map(e => ({
      id: e.id,
      title: e.title,
      date: e.date,
      event_code: e.event_code || null,
      latitude: e.latitude ?? null,
      longitude: e.longitude ?? null,
      radius: e.radius ?? null,
      attendance_points: e.attendance_points ?? 2,
      attendanceCount: counts[e.id] || 0,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch events" });
  }
});

router.put("/events/:id/location", requireAdmin, async (req, res) => {
  try {
    const { latitude, longitude, radius, attendance_points } = req.body;
    const update = {};
    if (latitude !== undefined) update.latitude = latitude;
    if (longitude !== undefined) update.longitude = longitude;
    if (radius !== undefined) update.radius = radius;
    if (attendance_points !== undefined) update.attendance_points = parseInt(attendance_points);

    const { data, error } = await supabase
      .from("events")
      .update(update)
      .eq("id", req.params.id)
      .select("id, title, latitude, longitude, radius")
      .single();
    if (error) {
      return res.status(500).json({ message: "Failed to update location" });
    }
    if (!data) return res.status(404).json({ message: "Event not found" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to update location" });
  }
});

router.put("/events/:id", requireAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ message: "Server configuration error: database not connected" });
    const { title, date, end_date, latitude, longitude, radius, attendance_points } = req.body;
    const update = {};
    if (title !== undefined) update.title = (title || "").trim().slice(0, 200);
    if (date !== undefined) update.date = date;
    if (end_date !== undefined) update.end_date = end_date ? end_date : null;
    if (latitude !== undefined) update.latitude = latitude !== "" ? parseFloat(latitude) : null;
    if (longitude !== undefined) update.longitude = longitude !== "" ? parseFloat(longitude) : null;
    if (radius !== undefined) update.radius = parseInt(radius) || 100;
    if (attendance_points !== undefined) update.attendance_points = parseInt(attendance_points) || 0;

    if (update.date && update.end_date && new Date(update.end_date) < new Date(update.date)) {
      return res.status(400).json({ message: "End date must be on or after the start date" });
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const { data, error } = await supabase
      .from("events")
      .update(update)
      .eq("id", req.params.id)
      .select("id, title, date, end_date, event_code, latitude, longitude, radius, attendance_points")
      .single();
    if (error) {
      return res.status(500).json({ message: "Failed to update event" });
    }
    if (!data) return res.status(404).json({ message: "Event not found" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to update event" });
  }
});

router.get("/events/:id/attendance", requireLeaderOrAdmin, async (req, res) => {
  try {
    let { data, error } = await supabase
      .from("attendance")
      .select(`
        id, member_id, event_id, timestamp, location, inside_zone,
        members!inner(name, role, academic_number, department)
      `)
      .eq("event_id", req.params.id)
      .order("timestamp", { ascending: false });

    if (error && (error.code === "42703" || error.message?.includes("inside_zone"))) {
      ({ data, error } = await supabase
        .from("attendance")
        .select(`
          id, member_id, event_id, timestamp, location,
          members!inner(name, role, academic_number, department)
        `)
        .eq("event_id", req.params.id)
        .order("timestamp", { ascending: false }));
    }

    if (error) {
      return res.status(500).json({ message: "Failed to fetch attendance" });
    }

    const rows = (data || []).map(a => ({
      id: a.id,
      memberId: a.member_id,
      memberName: a.members?.name || "",
      memberRole: a.members?.role || "",
      academicNumber: a.members?.academic_number || "",
      department: a.members?.department || "",
      timestamp: a.timestamp,
      location: a.location,
      insideZone: a.inside_zone ?? null,
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch attendance" });
  }
});

router.post("/events/:id/generate-qr", requireAdmin, async (req, res) => {
  try {
    const { data: event, error: fetchErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (fetchErr) {
      return res.status(500).json({ message: "Failed to fetch event" });
    }
    if (!event) return res.status(404).json({ message: "Event not found" });

    const eventCode = "EVT-" + event.id + "-" + Math.random().toString(36).slice(2, 8);

    const { error: updateErr } = await supabase
      .from("events")
      .update({ event_code: eventCode })
      .eq("id", event.id);
    if (updateErr) {
      if (updateErr.code === "42703" || updateErr.message?.includes("event_code")) {
        // event_code column may not exist yet — skip silently
      } else {
        return res.status(500).json({ message: "Failed to generate QR code" });
      }
    }

    const qrCode = JSON.stringify({
      eventCode,
      eventId: event.id,
      eventTitle: event.title,
      latitude: event.latitude || null,
      longitude: event.longitude || null,
      radius: event.radius || 100,
    });
    res.json({ qrCode, eventCode });
  } catch (err) {
    res.status(500).json({ message: "Failed to generate QR code" });
  }
});

router.get("/points/leaderboard", requireLeaderOrAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ message: "Server configuration error: database not connected" });
    const result = await calculateLeaderboard();
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to load leaderboard" });
  }
});

router.get("/users/:id/points", requireLeaderOrAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ message: "Server configuration error: database not connected" });

    const { data: attendanceRows } = await supabase
      .from("attendance")
      .select("event_id, timestamp")
      .eq("member_id", req.params.id)
      .order("timestamp", { ascending: false });

    const attendanceHistory = [];
    let attendancePoints = 0;

    if (attendanceRows && attendanceRows.length > 0) {
      const eventIds = [...new Set(attendanceRows.map(r => r.event_id))];
      const { data: eventRows } = await supabase
        .from("events")
        .select("id, title, attendance_points")
        .in("id", eventIds);

      const eventMap = {};
      (eventRows || []).forEach(e => { eventMap[e.id] = e; });

      attendanceRows.forEach(a => {
        const ev = eventMap[a.event_id];
        const pts = 2;
        attendancePoints += pts;
        attendanceHistory.push({
          id: `att-${a.event_id}-${a.timestamp}`,
          points: pts,
          transaction_type: "attendance",
          reason: `Attendance: ${ev?.title || "event"}`,
          created_at: a.timestamp,
          eventTitle: ev?.title || null,
          createdByName: null,
        });
      });
    }

    let adjustmentPoints = 0;
    let adjustmentHistory = [];
    try {
      const { data: txns } = await supabase
        .from("points_transactions")
        .select("id, points, transaction_type, reason, created_at, event_id, created_by, events(title), members!created_by(name)")
        .eq("user_id", req.params.id)
        .order("created_at", { ascending: false });

      if (txns) {
        txns.forEach(t => {
          if (t.transaction_type !== "attendance") {
            adjustmentPoints += t.points;
            adjustmentHistory.push({
              id: t.id,
              points: t.points,
              transaction_type: t.transaction_type,
              reason: t.reason,
              created_at: t.created_at,
              eventTitle: t.events?.title || null,
              createdByName: t.members?.name || null,
            });
          }
        });
      }
    } catch {}

    const allHistory = [...attendanceHistory, ...adjustmentHistory]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      balance: attendancePoints + adjustmentPoints,
      attendancePoints,
      adjustmentPoints,
      history: allHistory,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load points" });
  }
});

router.post("/users/:id/points", requireAdmin, async (req, res) => {
  try {
    const { points, transaction_type, reason: rawReason } = req.body;
    const reason = (rawReason || "").trim().slice(0, 500);
    const userId = parseInt(req.params.id);
    const numPoints = parseInt(points);
    if (!numPoints || numPoints === 0) return res.status(400).json({ message: "Points must be a non-zero number" });
    if (!reason) return res.status(400).json({ message: "Reason is required" });
    const validTypes = ["bonus", "penalty", "adjustment"];
    const txnType = validTypes.includes(transaction_type) ? transaction_type : "adjustment";

    const finalPoints = txnType === "penalty" ? -Math.abs(numPoints) : Math.abs(numPoints);

    const { data: txn, error: txnErr } = await supabase
      .from("points_transactions")
      .insert({
        user_id: userId,
        event_id: null,
        points: finalPoints,
        transaction_type: txnType,
        reason,
        created_by: req.user.id,
      })
      .select("id")
      .single();
    if (txnErr) {
      return res.status(500).json({ message: "Failed to record points" });
    }

    const { data: allTxns } = await supabase
      .from("points_transactions")
      .select("points")
      .eq("user_id", userId);
    const balance = (allTxns || []).reduce((sum, t) => sum + t.points, 0);

    res.json({ id: txn.id, balance });
  } catch (err) {
    res.status(500).json({ message: "Failed to adjust points" });
  }
});

router.delete("/events/:id", requireAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ message: "Server configuration error: database not connected" });
    const eventId = req.params.id;

    const { data: event, error: fetchErr } = await supabase
      .from("events")
      .select("id, title")
      .eq("id", eventId)
      .single();
    if (fetchErr || !event) return res.status(404).json({ message: "Event not found" });

    await supabase.from("attendance").delete().eq("event_id", eventId);
    await supabase.from("points_transactions").delete().eq("event_id", eventId);

    const { error: delErr } = await supabase.from("events").delete().eq("id", eventId);
    if (delErr) throw delErr;

    res.json({ message: `Event "${event.title}" and all related data deleted` });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete event" });
  }
});

router.put("/attendance/:id", requireAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ message: "Server configuration error: database not connected" });
    const { inside_zone, timestamp, notes } = req.body;

    const { data: existing, error: fetchErr } = await supabase
      .from("attendance")
      .select("id, member_id, event_id")
      .eq("id", req.params.id)
      .single();
    if (fetchErr || !existing) return res.status(404).json({ message: "Attendance record not found" });

    const updateData = {};
    if (inside_zone !== undefined) updateData.inside_zone = inside_zone;
    if (timestamp !== undefined) updateData.timestamp = timestamp;

    if (notes !== undefined) {
      const sanitizedNotes = (notes || "").trim().slice(0, 1000);
      const { error: notesErr } = await supabase
        .from("attendance")
        .update({ notes: sanitizedNotes })
        .eq("id", req.params.id);
      if (notesErr && notesErr.code === "42703") {
        // notes column may not exist — skip
      } else if (notesErr) {
        // ignore non-critical error
      }
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateErr } = await supabase
        .from("attendance")
        .update(updateData)
        .eq("id", req.params.id);
      if (updateErr) throw updateErr;
    }

    const { data: updated } = await supabase
      .from("attendance")
      .select("id, member_id, event_id, timestamp, location, inside_zone")
      .eq("id", req.params.id)
      .single();

    res.json({ message: "Attendance updated", record: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to update attendance" });
  }
});

router.delete("/attendance/:id", requireAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ message: "Server configuration error: database not connected" });

    const { data: record, error: fetchErr } = await supabase
      .from("attendance")
      .select("id, member_id, event_id")
      .eq("id", req.params.id)
      .single();
    if (fetchErr || !record) return res.status(404).json({ message: "Attendance record not found" });

    const { error: delErr } = await supabase
      .from("attendance")
      .delete()
      .eq("id", req.params.id);
    if (delErr) throw delErr;

    res.json({ message: "Attendance record deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete attendance record" });
  }
});

export default router;
