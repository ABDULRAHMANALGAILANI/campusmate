// =========================================================
// CampusMate: school-admin (Supabase Edge Function)
//
// Everything that needs the server's secret key lives here,
// because the browser must never have it:
//
//   list            school admin: everyone in their school
//   create          school admin: create student/professor
//                   accounts (one, or many from a CSV)
//   reset_password  school admin: give someone a new
//                   temporary password
//   set_active      school admin: turn an account off / on
//   set_my_password anyone: replace a temporary password
//                   with their own (first sign-in)
//   delete_my_account anyone without a school: delete their
//                   own account and data (PDPA)
//   delete_person   school admin: delete someone in their
//                   school, with all their data
//
// Deploy: Supabase Dashboard -> Edge Functions ->
//         Deploy a new function -> Via Editor
//         Name it exactly: school-admin
// =========================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_PER_REQUEST = 50;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["student", "professor"];

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

class Problem extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// Same rules as the website: 7+ characters, a letter, a number.
function passwordProblem(password: unknown) {
  if (typeof password !== "string" || password.length < 7) {
    return "Your password needs at least 7 characters.";
  }
  if (!/\p{L}/u.test(password)) {
    return "Your password needs at least one letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Your password needs at least one number.";
  }
  return "";
}

// Easy to read out loud: no 0/O, 1/l/I. e.g. "Hmqrt-4827"
function temporaryPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const random = new Uint32Array(9);
  crypto.getRandomValues(random);

  let word = letters[random[0] % letters.length].toUpperCase();
  for (let i = 1; i < 5; i++) {
    word += letters[random[i] % letters.length];
  }

  let number = "";
  for (let i = 5; i < 9; i++) {
    number += digits[random[i] % digits.length];
  }

  return `${word}-${number}`;
}

function serviceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  // Newer projects: secret keys are provided as JSON.
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return keys.default || Object.values(keys)[0];
  } catch {
    return undefined;
  }
}


// Removes a person's files, their rows, then the account.
// supabase/16-my-data.sql must have been run.
async function deleteAccount(admin: any, userId: string) {
  const { data: block, error: blockError } =
    await admin.rpc("account_delete_block", { target: userId });

  if (blockError) {
    throw new Problem("Run supabase/16-my-data.sql in Supabase first.", 500);
  }

  if (block) {
    const count = String(block).split(":")[1] || "";
    throw new Problem(
      `This account still owns ${count} ${count === "1" ? "class" : "classes"}. ` +
        "Delete those classes (or ask the school to move them) first."
    );
  }

  const { data: files } = await admin.rpc("user_file_paths", { target: userId });

  const byBucket = new Map<string, string[]>();
  for (const file of files || []) {
    if (!file?.path) continue;
    byBucket.set(file.bucket, [...(byBucket.get(file.bucket) || []), file.path]);
  }

  for (const [bucket, paths] of byBucket) {
    // Best effort: a missing file shouldn't stop the deletion
    await admin.storage.from(bucket).remove(paths).catch(() => null);
  }

  const { error: dataError } = await admin.rpc("delete_user_data", { target: userId });
  if (dataError) throw new Problem(dataError.message, 500);

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Problem(error.message, 500);
}


Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const key = serviceKey();
    if (!key) {
      throw new Problem("The server is missing its secret key.", 500);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ---- Who is calling? ----
    const token = (request.headers.get("Authorization") || "")
      .replace(/^Bearer\s+/i, "");

    const { data: auth } = await admin.auth.getUser(token);
    const caller = auth?.user;

    if (!caller) {
      throw new Problem("Please sign in again.", 401);
    }

    const body = await request.json().catch(() => ({}));
    const action = body?.action;


    // ---- Anyone: replace a temporary password ----
    if (action === "set_my_password") {
      const problem = passwordProblem(body.password);
      if (problem) throw new Problem(problem);

      const { error } = await admin.auth.admin.updateUserById(caller.id, {
        password: body.password,
        app_metadata: {
          ...caller.app_metadata,
          must_change_password: false,
        },
      });

      if (error) throw new Problem(error.message);
      return reply({ ok: true });
    }


    // ---- Anyone without a school: delete my account ----
    if (action === "delete_my_account") {
      if (body.confirm !== "DELETE") {
        throw new Problem("Type DELETE to confirm.");
      }

      const { data: self } = await admin
        .from("profiles")
        .select("role, school_id")
        .eq("id", caller.id)
        .maybeSingle();

      if (self?.school_id) {
        throw new Problem(
          "Your school manages your account. Ask your school admin to delete it.",
          403
        );
      }

      await deleteAccount(admin, caller.id);
      return reply({ ok: true });
    }


    // ---- Everything else: school admins only ----
    const { data: me } = await admin
      .from("profiles")
      .select("role, school_id")
      .eq("id", caller.id)
      .maybeSingle();

    if (me?.role !== "school_admin" || !me?.school_id) {
      throw new Problem("Only school admins can do this.", 403);
    }

    const schoolId: string = me.school_id;

    // A person the admin is allowed to manage.
    async function memberOfMySchool(userId: unknown) {
      if (typeof userId !== "string" || userId === caller!.id) {
        throw new Problem("You can't change this account.", 403);
      }

      const { data } = await admin
        .from("profiles")
        .select("id, role, school_id")
        .eq("id", userId)
        .maybeSingle();

      if (!data || data.school_id !== schoolId || data.role === "school_admin") {
        throw new Problem("This person isn't in your school.", 403);
      }

      return data;
    }


    // ---- list ----
    if (action === "list") {
      const { data: people, error } = await admin
        .from("profiles")
        .select(
          "id, full_name, role, campus_id, student_id, programme, created_at"
        )
        .eq("school_id", schoolId)
        .order("full_name", { ascending: true });

      if (error) throw new Problem(error.message, 500);

      // Emails and sign-in details live in the auth system.
      const wanted = new Set((people || []).map((p) => p.id));
      const details = new Map();

      for (let page = 1; page <= 50 && details.size < wanted.size; page++) {
        const { data, error: listError } =
          await admin.auth.admin.listUsers({ page, perPage: 1000 });

        if (listError) throw new Problem(listError.message, 500);

        for (const user of data.users) {
          if (wanted.has(user.id)) details.set(user.id, user);
        }

        if (data.users.length < 1000) break;
      }

      const now = Date.now();

      return reply({
        people: (people || []).map((person) => {
          const user = details.get(person.id);
          const bannedUntil = user?.banned_until
            ? new Date(user.banned_until).getTime()
            : 0;

          return {
            ...person,
            email: user?.email || "",
            last_sign_in_at: user?.last_sign_in_at || null,
            active: !(bannedUntil > now),
            must_change_password: Boolean(
              user?.app_metadata?.must_change_password
            ),
          };
        }),
      });
    }


    // ---- create ----
    if (action === "create") {
      const rows = Array.isArray(body.people) ? body.people : [];

      if (rows.length === 0) {
        throw new Problem("Add at least one person.");
      }
      if (rows.length > MAX_PER_REQUEST) {
        throw new Problem(`Send at most ${MAX_PER_REQUEST} people at a time.`);
      }

      const results = [];

      for (const row of rows) {
        const fullName = String(row?.full_name || "").trim();
        const email = String(row?.email || "").trim().toLowerCase();
        const role = String(row?.role || "student").trim().toLowerCase();
        const studentId = String(row?.student_id || "").trim() || null;
        const programme = String(row?.programme || "").trim() || null;

        const result: Record<string, unknown> = {
          full_name: fullName,
          email,
          role,
        };

        if (!fullName) {
          results.push({ ...result, ok: false, error: "Name is missing." });
          continue;
        }
        if (fullName.split(/\s+/).length < 2 || /[0-9]/.test(fullName)) {
          results.push({
            ...result,
            ok: false,
            error: "Use their full name (first and last name, no numbers).",
          });
          continue;
        }
        if (!EMAIL_PATTERN.test(email)) {
          results.push({ ...result, ok: false, error: "Email isn't valid." });
          continue;
        }
        if (!ROLES.includes(role)) {
          results.push({
            ...result,
            ok: false,
            error: "Role must be student or professor.",
          });
          continue;
        }

        const password = temporaryPassword();

        const { data: created, error: createError } =
          await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName },
            app_metadata: {
              role,
              school_id: schoolId,
              must_change_password: true,
            },
          });

        if (createError || !created?.user) {
          const taken = /already|registered|exists/i.test(
            createError?.message || ""
          );

          // CampusMate's database checks names (real first and
          // last name, no usernames or rude words).
          const nameRejected = /database error/i.test(
            createError?.message || ""
          );

          results.push({
            ...result,
            ok: false,
            error: taken
              ? "This email already has a CampusMate account."
              : nameRejected
                ? "CampusMate didn't accept this name. Use their real first and last name."
                : createError?.message || "Could not create the account.",
          });
          continue;
        }

        const userId = created.user.id;

        // The database normally makes the profile itself;
        // make one if it didn't, then fill in the details.
        const { data: existing } = await admin
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .maybeSingle();

        if (!existing) {
          await admin
            .from("profiles")
            .insert({ id: userId, full_name: fullName });
        }

        const { data: profile, error: profileError } = await admin
          .from("profiles")
          .update({
            full_name: fullName,
            role,
            school_id: schoolId,
            student_id: role === "student" ? studentId : null,
            programme,
          })
          .eq("id", userId)
          .select("campus_id")
          .maybeSingle();

        if (profileError) {
          // Don't leave half-made accounts behind.
          await admin.auth.admin.deleteUser(userId);

          results.push({
            ...result,
            ok: false,
            error: "Could not set up the profile: " + profileError.message,
          });
          continue;
        }

        results.push({
          ...result,
          ok: true,
          id: userId,
          campus_id: profile?.campus_id || "",
          temporary_password: password,
        });
      }

      return reply({ results });
    }


    // ---- reset_password ----
    if (action === "reset_password") {
      await memberOfMySchool(body.user_id);

      const { data: target } =
        await admin.auth.admin.getUserById(body.user_id);

      const password = temporaryPassword();

      const { error } = await admin.auth.admin.updateUserById(body.user_id, {
        password,
        app_metadata: {
          ...(target?.user?.app_metadata || {}),
          must_change_password: true,
        },
      });

      if (error) throw new Problem(error.message);
      return reply({ ok: true, temporary_password: password });
    }


    // ---- update_person: fix a name, email, student ID or programme ----
    if (action === "update_person") {
      const person = await memberOfMySchool(body.user_id);

      const fullName = String(body.full_name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const studentId = String(body.student_id || "").trim() || null;
      const programme = String(body.programme || "").trim() || null;

      if (!fullName || fullName.split(/\s+/).length < 2 || /[0-9]/.test(fullName)) {
        throw new Problem("Use their full name (first and last name, no numbers).");
      }
      if (!EMAIL_PATTERN.test(email)) {
        throw new Problem("That email isn't valid.");
      }

      const { data: current } =
        await admin.auth.admin.getUserById(body.user_id);

      if (current?.user && current.user.email !== email) {
        const { error: emailError } =
          await admin.auth.admin.updateUserById(body.user_id, {
            email,
            email_confirm: true,
          });

        if (emailError) {
          throw new Problem(
            /already|registered|exists/i.test(emailError.message)
              ? "Another CampusMate account already uses this email."
              : emailError.message
          );
        }
      }

      const { error: profileError } = await admin
        .from("profiles")
        .update({
          full_name: fullName,
          student_id: person.role === "student" ? studentId : null,
          programme,
        })
        .eq("id", body.user_id);

      if (profileError) {
        throw new Problem(
          /database error|full name|real full name/i.test(profileError.message)
            ? "CampusMate didn't accept this name. Use their real first and last name."
            : profileError.message
        );
      }

      return reply({ ok: true });
    }


    // ---- set_active ----
    if (action === "set_active") {
      await memberOfMySchool(body.user_id);

      const { error } = await admin.auth.admin.updateUserById(body.user_id, {
        // About 100 years = turned off until switched back on.
        ban_duration: body.active ? "none" : "876000h",
      });

      if (error) throw new Problem(error.message);
      return reply({ ok: true });
    }


    // ---- delete_person (everything about them) ----
    if (action === "delete_person") {
      await memberOfMySchool(body.user_id);

      if (body.confirm !== "DELETE") {
        throw new Problem("Type DELETE to confirm.");
      }

      await deleteAccount(admin, body.user_id);
      return reply({ ok: true });
    }


    throw new Problem("Unknown action.");

  } catch (error) {
    const status = error instanceof Problem ? error.status : 500;
    const message = error instanceof Error
      ? error.message
      : "Something went wrong.";

    return reply({ error: message }, status);
  }
});
