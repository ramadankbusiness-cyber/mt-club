import express from "express";
import { supabase } from "../config/supabase.js";
import { requireAdmin, requireLeaderOrAdmin } from "../middleware/role.js";
import { ensureBucket, getPublicUrl } from "../utils/storage.js";

const router = express.Router();
const BUCKET = "uploads";

const COMMITTEE_MAP = {
  chairman: "Chairman",
  leadership: "MTC",
  oc: "OC",
  tech: "Tech",
  pr: "PR",
  hr: "HR",
  logistics: "Logistics",
  firstaid: "First Aid",
  media: "Media",
};

function toDbRole(committeeId, role) {
  if (committeeId === "chairman") {
    if (role === "head") return "Chairman";
    return null;
  }
  const suffix = COMMITTEE_MAP[committeeId];
  if (!suffix) return null;
  if (role === "head") return `Head ${suffix}`;
  if (role === "vice") return `Vice Head ${suffix}`;
  if (role === "leader1") return `Leader 1 ${suffix}`;
  if (role === "leader2") return `Leader 2 ${suffix}`;
  if (role === "leader") return `Leader ${suffix}`;
  return null;
}

function fromDbRole(dbRole) {
  if (dbRole === "Chairman") return { committeeId: "chairman", role: "head" };
  for (const [committeeId, suffix] of Object.entries(COMMITTEE_MAP)) {
    if (committeeId === "chairman") continue;
    if (dbRole === `Head ${suffix}`) return { committeeId, role: "head" };
    if (dbRole === `Vice Head ${suffix}`) return { committeeId, role: "vice" };
    if (dbRole === `Leader 1 ${suffix}`) return { committeeId, role: "leader1" };
    if (dbRole === `Leader 2 ${suffix}`) return { committeeId, role: "leader2" };
    if (dbRole === `Leader ${suffix}`) return { committeeId, role: "leader" };
  }
  return null;
}

async function listTeamImages() {
  const { data: files, error } = await supabase.storage
    .from(BUCKET)
    .list("team", { limit: 100 });

  if (error || !files) return {};

  const urlMap = {};
  for (const file of files) {
    const match = file.name.match(/^([a-z]+)-([a-z0-9]+)-(\d+)\.\w+$/);
    if (!match) continue;
    const [, committeeId, role] = match;
    const key = `${committeeId}-${role}`;
    const timestamp = parseInt(match[3]);
    const existing = urlMap[key];
    if (!existing || timestamp > existing.timestamp) {
      urlMap[key] = {
        timestamp,
        url: getPublicUrl(BUCKET, `team/${file.name}`),
      };
    }
  }
  return urlMap;
}

function buildTeamResponse(rows, imageMap) {
  const ROLES = ["head", "vice", "leader1", "leader2", "leader"];
  const result = {};
  for (const [cid] of Object.entries(COMMITTEE_MAP)) {
    result[cid] = {};
    for (const r of ROLES) {
      result[cid][r] = { id: null, name: "", imageUrl: "" };
    }
  }

  for (const row of rows) {
    const parsed = fromDbRole(row.role);
    if (!parsed) continue;
    const { committeeId, role } = parsed;
    const imgKey = `${committeeId}-${role}`;
    const imgEntry = imageMap[imgKey];
    result[committeeId][role] = {
      id: row.id,
      name: row.name || "",
      imageUrl: row.has_image && imgEntry ? imgEntry.url : "",
    };
  }
  return result;
}

router.get("/", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ message: "Database not configured" });
    }

    const { data: rows, error } = await supabase
      .from("team")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      return res.status(500).json({ message: "Failed to fetch team data" });
    }

    const imageMap = await listTeamImages();
    res.json(buildTeamResponse(rows || [], imageMap));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch team data" });
  }
});

router.put("/update", requireLeaderOrAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ message: "Database not configured" });
    }

    const { id: teamRowId, committeeId, role, name, image } = req.body;
    if (!committeeId || !role) {
      return res.status(400).json({ message: "committeeId and role are required" });
    }

    if (req.user.role === "leader" && req.user.committee !== committeeId) {
      return res.status(403).json({ message: "Can only edit your own committee" });
    }

    const dbRole = toDbRole(committeeId, role);
    if (!dbRole) {
      return res.status(400).json({ message: "Invalid committeeId or role" });
    }

    let row = null;

    if (teamRowId) {
      const { data: found } = await supabase
        .from("team")
        .select("*")
        .eq("id", teamRowId)
        .maybeSingle();
      row = found;
    }

    if (!row) {
      const { data: found } = await supabase
        .from("team")
        .select("*")
        .eq("role", dbRole)
        .maybeSingle();
      row = found;
    }

    if (!row) {
      return res.status(404).json({ message: `Team member not found for "${dbRole}". Please reload the page and try again.` });
    }

    if (name !== undefined && name !== null) {
      const sanitizedName = (name || "").trim().slice(0, 100);
      const { error: nameErr } = await supabase
        .from("team")
        .update({ name: sanitizedName })
        .eq("id", row.id);
      if (nameErr) {
        return res.status(500).json({ message: "Failed to update name" });
      }
    }

    if (image === "") {
      const files = await supabase.storage.from(BUCKET).list("team");
      if (files.data) {
        const prefix = `${committeeId}-${role}-`;
        const toRemove = files.data.filter(f => f.name.startsWith(prefix)).map(f => `team/${f.name}`);
        if (toRemove.length > 0) {
          await supabase.storage.from(BUCKET).remove(toRemove);
        }
      }
      const { error: imgErr } = await supabase
        .from("team")
        .update({ has_image: 0 })
        .eq("id", row.id);
    } else if (image && typeof image === "string" && image.startsWith("data:")) {
      const parsed = image.match(/^data:(.*?);base64,(.+)$/);
      if (!parsed) {
        return res.status(400).json({ message: "Invalid image data" });
      }
      const contentType = parsed[1];
      if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
        return res.status(400).json({ message: "Invalid image type" });
      }
      const buffer = Buffer.from(parsed[2], "base64");
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "Image too large (max 5MB)" });
      }
      const ext = contentType.split("/")[1] || "png";
      const filename = `${committeeId}-${role}-${Date.now()}.${ext}`;
      const filePath = `team/${filename}`;

      await ensureBucket(BUCKET);
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, buffer, { contentType, upsert: true });

      if (uploadErr) {
        return res.status(500).json({ message: "Failed to upload image" });
      }

      const { error: imgErr } = await supabase
        .from("team")
        .update({ has_image: 1 })
        .eq("id", row.id);

      const oldFiles = await supabase.storage.from(BUCKET).list("team");
      if (oldFiles.data) {
        const prefix = `${committeeId}-${role}-`;
        const oldFilesToRemove = oldFiles.data
          .filter(f => f.name.startsWith(prefix) && f.name !== filename)
          .map(f => `team/${f.name}`);
        if (oldFilesToRemove.length > 0) {
          await supabase.storage.from(BUCKET).remove(oldFilesToRemove);
        }
      }
    }

    const { data: updated } = await supabase
      .from("team")
      .select("*")
      .eq("id", row.id)
      .single();

    const imageMap = await listTeamImages();
    const fullTeam = buildTeamResponse(
      (await supabase.from("team").select("*").order("sort_order")).data || [],
      imageMap
    );

    const parsed = fromDbRole(row.role);
    res.json({
      message: "Saved",
      data: fullTeam[parsed?.committeeId],
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to save team data" });
  }
});

export default router;
