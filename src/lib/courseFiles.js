import { supabase } from "./supabase";


// =========================================================
// COURSE FILE HELPERS
// Two private stores (see supabase/9-course-pages.sql):
//   course-files : <class id>/<file>
//   submissions  : <class id>/<assignment id>/<student id>/<file>
//   excuses      : <class id>/<student id>/<file>   (MC etc.)
// =========================================================

export const MATERIAL_LIMIT_MB = 50;
export const SUBMISSION_LIMIT_MB = 25;
export const EXCUSE_LIMIT_MB = 10;


function safeName(name) {
  const cleaned =
    String(name || "file")
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(-80);

  return cleaned || "file";
}


function uniquePrefix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}


export function tooBig(file, limitMb) {
  return file && file.size > limitMb * 1024 * 1024;
}


export function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


export async function uploadMaterial(groupId, file) {
  const path =
    `${groupId}/${uniquePrefix()}-${safeName(file.name)}`;

  const { error } =
    await supabase.storage
      .from("course-files")
      .upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

  if (error) throw error;

  return path;
}


export async function uploadSubmission(groupId, assignmentId, studentId, file) {
  const path =
    `${groupId}/${assignmentId}/${studentId}/${uniquePrefix()}-${safeName(file.name)}`;

  const { error } =
    await supabase.storage
      .from("submissions")
      .upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

  if (error) throw error;

  return path;
}


export async function uploadExcuse(groupId, studentId, file) {
  const path =
    `${groupId}/${studentId}/${uniquePrefix()}-${safeName(file.name)}`;

  const { error } =
    await supabase.storage
      .from("excuses")
      .upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

  if (error) throw error;

  return path;
}


export async function removeFile(bucket, path) {
  if (!path) return;

  await supabase.storage
    .from(bucket)
    .remove([path]);
}


// Downloads a private file (the link works for 2 minutes).
export async function openFile(bucket, path, fileName) {
  const { data, error } =
    await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 120, {
        download: fileName || true,
      });

  if (error || !data?.signedUrl) {
    throw error || new Error("Couldn't open the file.");
  }

  const link =
    document.createElement("a");

  link.href = data.signedUrl;
  link.target = "_blank";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
