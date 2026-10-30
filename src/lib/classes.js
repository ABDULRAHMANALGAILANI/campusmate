import { supabase } from "./supabase";


// =========================================================
// CLASSES A PROFESSOR TEACHES
// Own classes + classes where they are a co-lecturer or tutor
// (supabase/14-real-classroom.sql). Falls back to own classes
// if that SQL hasn't been run yet.
// =========================================================

// Archived classes (supabase/18) are left out unless asked for.
export async function loadTeachingClasses(userId, { includeArchived = false } = {}) {
  const viaRpc =
    await supabase.rpc("my_teaching_classes");

  let rows = viaRpc.data || [];

  if (viaRpc.error) {
    const { data } =
      await supabase
        .from("course_groups")
        .select("*")
        .eq("professor_id", userId)
        .order("created_at", { ascending: false });

    rows = data || [];
  }

  return includeArchived ? rows : rows.filter((group) => !group.archived_at);
}


export function isArchived(group) {
  return Boolean(group?.archived_at);
}


// Leaves out classes from past semesters (archived), so their
// old deadlines and class times don't show on the calendar/to-do.
// Before supabase/18 there is no archived_at, so nothing is removed.
export async function currentClassIds(groupIds) {
  if (!groupIds.length) return [];

  const { data, error } =
    await supabase
      .from("course_groups")
      .select("*")
      .in("id", groupIds);

  if (error) return groupIds;

  return (data || [])
    .filter((group) => !group.archived_at)
    .map((group) => group.id);
}
