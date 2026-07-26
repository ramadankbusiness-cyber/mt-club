import express from "express";
import { supabase } from "../config/supabase.js";
import { requireMember, requireAdmin } from "../middleware/role.js";
import { calculateUserPoints } from "../utils/points.js";

const router = express.Router();

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.post("/", requireMember, async (req, res) => {
  const { memberId, eventId, eventCode, location, latitude, longitude } = req.body;
  if (!eventId && !eventCode) return res.status(400).json({ message: "Event ID or Event Code required" });

  if (parseInt(memberId) !== req.user.id && req.user.role === "member") {
    return res.status(403).json({ message: "Cannot mark attendance for another member" });
  }
  const actualMemberId = req.user.id;

  try {
    let query = supabase.from("events").select("*");
    if (eventId) {
      query = query.eq("id", eventId);
    } else {
      query = query.eq("event_code", (eventCode || "").trim());
    }
    const { data: event, error: eventErr } = await query.maybeSingle();

    if (eventErr) {
      return res.status(500).json({ message: "Failed to look up event" });
    }
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.latitude != null && event.longitude != null && latitude != null && longitude != null) {
      const dist = haversineDistance(latitude, longitude, event.latitude, event.longitude);
      const radius = event.radius || 100;
      if (dist > radius) {
        return res.status(403).json({
          message: `You are ${Math.round(dist)}m away from the event. Must be within ${radius}m.`,
          distance: Math.round(dist),
          radius,
        });
      }
    }

    const { data: existing } = await supabase
      .from("attendance")
      .select("id")
      .eq("member_id", actualMemberId)
      .eq("event_id", event.id)
      .single();

    if (existing) return res.status(409).json({ message: "Already registered for this event" });

    let insideZone = null;
    if (event.latitude != null && event.longitude != null && latitude != null && longitude != null) {
      const dist = haversineDistance(latitude, longitude, event.latitude, event.longitude);
      const radius = event.radius || 100;
      insideZone = dist <= radius;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("attendance")
      .insert({
        member_id: actualMemberId,
        event_id: event.id,
        location: (location || "Unknown").slice(0, 255),
      })
      .select("id")
      .single();

    if (insertErr) {
      return res.status(500).json({ message: "Failed to register attendance" });
    }

    if (insideZone !== null) {
      const { error: updateErr } = await supabase
        .from("attendance")
        .update({ inside_zone: insideZone })
        .eq("id", inserted.id);
      if (updateErr && updateErr.code !== "42703") {
        // inside_zone column may not exist yet — ignore
      }
    }

    const pointsToAward = 2;
    let newBalance = null;
    try {
      const pointsData = await calculateUserPoints(memberId);
      newBalance = pointsData.total;
    } catch {}

    res.json({ message: `Attendance registered for ${event?.title || "event"}`, pointsAwarded: pointsToAward, newBalance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/event/:eventId", requireMember, async (req, res) => {
  try {
    const { data } = await supabase
      .from("attendance")
      .select(`
        id, member_id, event_id, timestamp, location,
        members!inner(name, role)
      `)
      .eq("event_id", req.params.eventId)
      .order("timestamp", { ascending: false });

    const rows = (data || []).map(a => ({
      id: a.id,
      memberName: a.members?.name || "",
      memberRole: a.members?.role || "",
      eventTitle: "",
      timestamp: a.timestamp,
      location: a.location,
      eventId: a.event_id,
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/all", requireAdmin, async (req, res) => {
  try {
    const { data } = await supabase
      .from("attendance")
      .select(`
        id,
        member_id,
        event_id,
        timestamp,
        location,
        members!inner(name, role),
        events!inner(title)
      `)
      .order("timestamp", { ascending: false });

    const rows = (data || []).map(a => ({
      id: a.id,
      memberName: a.members?.name || "",
      memberRole: a.members?.role || "",
      eventTitle: a.events?.title || "",
      timestamp: a.timestamp,
      location: a.location,
      eventId: a.event_id,
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/user/:id", requireMember, async (req, res) => {
  const userId = parseInt(req.params.id);
  if (req.user.role === "member" && req.user.id !== userId) {
    return res.status(403).json({ message: "Can only view own attendance" });
  }
  try {
    const { data } = await supabase
      .from("attendance")
      .select(`
        id,
        timestamp,
        location,
        events!inner(title)
      `)
      .eq("member_id", userId)
      .order("timestamp", { ascending: false });

    const rows = (data || []).map(a => ({
      id: a.id,
      eventTitle: a.events?.title || "",
      timestamp: a.timestamp,
      location: a.location,
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
