import multer from "multer";
import { supabase } from "../config/supabase.js";

export const isVercel = process.env.VERCEL === "1";
const BUCKET = "uploads";
const bucketsReady = new Set();

export async function ensureBucket(bucketName) {
  if (bucketsReady.has(bucketName)) return;
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error(`[Storage] listBuckets error:`, listErr.message);
  }
  const exists = buckets?.some((b) => b.name === bucketName);
  if (!exists) {
    const { error: createErr } = await supabase.storage.createBucket(bucketName, { public: true });
    if (createErr && createErr.message !== "Bucket already exists") {
      console.error(`[Storage] createBucket "${bucketName}" error:`, createErr.message);
      throw new Error(`Failed to create storage bucket "${bucketName}": ${createErr.message}`);
    }
  }
  bucketsReady.add(bucketName);
}

export function getPublicUrl(bucket, filePath) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function uploadToStorage(bucket, filePath, buffer, contentType) {
  await ensureBucket(bucket);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType: contentType || "application/octet-stream",
      upsert: true,
    });
  if (error) throw error;
  return getPublicUrl(bucket, filePath);
}

export function createMulter(category, filenameFn) {
  const mul = multer({ storage: multer.memoryStorage() });
  return {
    single(fieldName) {
      return (req, res, next) => {
        mul.single(fieldName)(req, res, (err) => {
          if (err) return next(err);
          if (req.file) {
            filenameFn(req, { originalname: req.file.originalname }, (err2, name) => {
              if (!err2 && name) req.file.filename = name;
            });
          }
          next();
        });
      };
    },
  };
}

export async function saveUpload(file, category, filename) {
  await ensureBucket(BUCKET);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${category}/${filename}`, file.buffer, {
      contentType: file.mimetype || "application/octet-stream",
      upsert: true,
    });
  if (error) throw error;
}

export async function deleteUpload(category, filename) {
  await supabase.storage
    .from(BUCKET)
    .remove([`${category}/${filename}`])
    .catch(() => {});
}
