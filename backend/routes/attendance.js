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

  const hasCoords = latitude !== undefined && latitude !== null && latitude !== "" &&
                    longitude !== undefined && longitude !== null && longitude !== "";
  let lat = null;
  let lon = null;
  if (hasCoords) {
    lat = parseFloat(latitude);
    lon = parseFloat(longitude);
    if (!isFinite(lat) || lat < -90 || lat > 90 || !isFinite(lon) || lon < -180 || lon > 180) {
      return res.status(400).json({ message: "Invalid latitude or longitude" });
    }
  }

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

    if (event.is_active === false) {
      return res.status(403).json({ message: "Event is not active for check-in" });
    }

    const hasEventLocation = event.latitude != null && event.longitude != null;
    if (hasEventLocation && !hasCoords) {
      return res.status(400).json({ message: "Latitude and longitude are required for this event" });
    }

    let distance = null;
    let insideZone = null;
    if (hasEventLocation && hasCoords) {
      const radius = event.radius || 100;
      distance = haversineDistance(lat, lon, event.latitude, event.longitude);
      insideZone = distance <= radius;
      if (!insideZone) {
        return res.status(403).json({
          message: `You are ${Math.round(distance)}m away from the event location. Must be within ${radius}m.`,
          distance: Math.round(distance),
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

    const insertPayload = {
      member_id: actualMemberId,
      event_id: event.id,
      location: (location || "Unknown").slice(0, 255),
    };
    if (insideZone !== null) {
      insertPayload.inside_zone = insideZone;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("attendance")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertErr) {
      return res.status(500).json({ message: "Failed to register attendance" });
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

// Zone check-in status (members): tells the app if the user is inside the active
// event's location radius and whether they've already checked in.
// The event's OWN latitude/longitude/radius are the attendance zone.
router.get("/zone/status", requireMember, async (req, res) => {
  const latitude = req.query.latitude !== undefined ? parseFloat(req.query.latitude) : NaN;
  const longitude = req.query.longitude !== undefined ? parseFloat(req.query.longitude) : NaN;

  if (!isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !isFinite(longitude) || longitude < -180 || longitude > 180) {
    return res.status(400).json({ message: "Invalid latitude or longitude" });
  }

  try {
    const { data: activeEvent, error: eventErr } = await supabase
      .from("events")
      .select("*")
      .eq("is_active", true)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    let event = activeEvent;
    if (eventErr && (eventErr.code === "42703" || eventErr.message?.includes("is_active"))) {
      const { data: fallback, error: fallbackErr } = await supabase
        .from("events")
        .select("*")
        .not("latitude", "is", null)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fallbackErr) {
        return res.status(500).json({ message: "Failed to fetch zone status" });
      }
      event = fallback;
    } else if (eventErr) {
      return res.status(500).json({ message: "Failed to fetch zone status" });
    }

    if (!event || event.latitude == null || event.longitude == null) {
      return res.json({ event: null, inside: false, distance: null, alreadyCheckedIn: false });
    }

    const radius = event.radius || 100;
    const distance = haversineDistance(latitude, longitude, event.latitude, event.longitude);
    const inside = distance <= radius;

    let alreadyCheckedIn = false;
    const { data: myAttendance } = await supabase
      .from("attendance")
      .select("id")
      .eq("member_id", req.user.id)
      .eq("event_id", event.id)
      .maybeSingle();
    alreadyCheckedIn = !!(myAttendance && myAttendance.id);

    res.json({
      event: {
        id: event.id,
        title: event.title,
        date: event.date,
        image: event.image || "",
        latitude: event.latitude,
        longitude: event.longitude,
        radius,
      },
      inside,
      distance: Math.round(distance),
      alreadyCheckedIn,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch zone status" });
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
