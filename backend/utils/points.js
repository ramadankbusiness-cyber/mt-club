import { supabase } from "../config/supabase.js";

const POINTS_PER_EVENT = 2;

export async function calculateUserPoints(userId) {
  let attendancePoints = 0;
  let attendanceCount = 0;

  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("event_id")
    .eq("member_id", userId);

  if (attendanceRows && attendanceRows.length > 0) {
    attendanceCount = attendanceRows.length;
    attendancePoints = attendanceCount * POINTS_PER_EVENT;
  }

  let adjustmentPoints = 0;
  let adjustmentHistory = [];
  try {
    const { data: txns } = await supabase
      .from("points_transactions")
      .select("id, points, transaction_type, reason, created_at, event_id, created_by")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (txns) {
      txns.forEach(t => {
        if (t.transaction_type !== "attendance") {
          adjustmentPoints += t.points;
          adjustmentHistory.push(t);
        }
      });
    }
  } catch {}

  return {
    total: attendancePoints + adjustmentPoints,
    attendancePoints,
    attendanceCount,
    adjustmentPoints,
    adjustmentHistory,
  };
}

export async function calculateLeaderboard() {
  const { data: allAttendance } = await supabase
    .from("attendance")
    .select("member_id, event_id");

  const { data: allUsers } = await supabase
    .from("members")
    .select("id, name, role, has_image, academic_number, enabled")
    .order("name", { ascending: true });

  const attendanceCounts = {};
  (allAttendance || []).forEach(a => {
    attendanceCounts[a.member_id] = (attendanceCounts[a.member_id] || 0) + 1;
  });

  const attendancePoints = {};
  Object.keys(attendanceCounts).forEach(uid => {
    attendancePoints[uid] = attendanceCounts[uid] * POINTS_PER_EVENT;
  });

  let adjustmentPoints = {};
  try {
    const { data: txns } = await supabase
      .from("points_transactions")
      .select("user_id, points, transaction_type");
    if (txns) {
      txns.forEach(t => {
        if (t.transaction_type !== "attendance") {
          adjustmentPoints[t.user_id] = (adjustmentPoints[t.user_id] || 0) + t.points;
        }
      });
    }
  } catch {}

  return (allUsers || []).map(u => ({
    id: u.id,
    name: u.name,
    role: u.role,
    has_image: u.has_image,
    academic_number: u.academic_number,
    enabled: u.enabled,
    points: (attendancePoints[u.id] || 0) + (adjustmentPoints[u.id] || 0),
    attendanceCount: attendanceCounts[u.id] || 0,
  })).sort((a, b) => b.points - a.points);
}
