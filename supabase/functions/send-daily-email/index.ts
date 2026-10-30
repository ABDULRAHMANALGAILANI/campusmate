// =========================================================
// CampusMate: send-daily-email (Supabase Edge Function)
//
// Once a day (21-schedule-daily-email.sql calls it) everyone
// with unread notifications gets ONE email listing them.
// Sent through Brevo (the same service as the sign-up emails).
//
//   Daily run   called by the timer with the header
//               x-cron-secret: <CRON_SECRET>
//   Test        a signed-in person can send their own email
//               now: { "action": "test" } (Settings button)
//
// Secrets (Supabase -> Edge Functions -> Secrets):
//   BREVO_API_KEY  Brevo -> SMTP & API -> API keys (starts xkeysib-)
//   EMAIL_FROM     a sender you verified in Brevo, e.g. you@gmail.com
//   SITE_URL       where CampusMate runs, e.g. http://localhost:5173
//   CRON_SECRET    any long random text (same as in the SQL file)
//
// Deploy: Supabase Dashboard -> Edge Functions ->
//         Deploy a new function -> Via Editor
//         Name it exactly: send-daily-email
//         Turn OFF "Verify JWT" (it checks callers itself)
// Needs supabase/20-email-notifications.sql.
// =========================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ITEMS = 15;

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function serviceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return keys.default || Object.values(keys)[0];
  } catch {
    return undefined;
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Same-site links only (never an outside address)
function linkFor(site: string, link: unknown) {
  const path = typeof link === "string" && link.startsWith("/") && !link.startsWith("//")
    ? link
    : "/dashboard";
  return site + path;
}

type Item = {
  id: string;
  title: string;
  message: string | null;
  category: string | null;
  link: string | null;
};

function buildEmail(name: string, items: Item[], site: string) {
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  const shown = items.slice(0, MAX_ITEMS);
  const more = items.length - shown.length;

  const subject = items.length === 1
    ? `CampusMate: ${items[0].title}`
    : `CampusMate: ${items.length} new updates`;

  const rows = shown.map((item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e2e8f0">
          <a href="${escapeHtml(linkFor(site, item.link))}" style="color:#1d4ed8;font-weight:600;text-decoration:none">${escapeHtml(item.title)}</a>
          ${item.message ? `<div style="color:#475569;font-size:14px;margin-top:3px">${escapeHtml(item.message)}</div>` : ""}
        </td>
      </tr>`).join("");

  const html = `<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;padding:24px">
        <tr><td style="font-size:20px;font-weight:700;color:#0f172a">CampusMate</td></tr>
        <tr><td style="padding:14px 0 6px;color:#0f172a;font-size:15px">Hi ${escapeHtml(first)}, here's what's new:</td></tr>
        <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
        ${more > 0 ? `<tr><td style="padding-top:12px;color:#475569;font-size:14px">…and ${more} more.</td></tr>` : ""}
        <tr><td style="padding-top:20px">
          <a href="${escapeHtml(site)}/dashboard" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 18px;border-radius:9px;text-decoration:none;font-weight:600">Open CampusMate</a>
        </td></tr>
        <tr><td style="padding-top:22px;color:#94a3b8;font-size:12px">
          You get at most one email a day, only when there's something new.
          Turn it off in CampusMate: Settings → Email notifications.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Hi ${first}, here's what's new on CampusMate:`,
    "",
    ...shown.map((item) => `• ${item.title}${item.message ? ` (${item.message})` : ""}\n  ${linkFor(site, item.link)}`),
    more > 0 ? `…and ${more} more.` : "",
    "",
    "Turn these emails off in CampusMate: Settings → Email notifications.",
  ].join("\n");

  return { subject, html, text };
}

async function sendWithBrevo(to: string, name: string, mail: { subject: string; html: string; text: string }) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": Deno.env.get("BREVO_API_KEY") || "",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "CampusMate", email: Deno.env.get("EMAIL_FROM") },
      to: [{ email: to, name: name || to }],
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Brevo said ${response.status}: ${detail.slice(0, 200)}`);
  }
}


Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const key = serviceKey();
    if (!key) return reply({ error: "The server is missing its secret key." }, 500);

    if (!Deno.env.get("BREVO_API_KEY") || !Deno.env.get("EMAIL_FROM")) {
      return reply({ error: "Email isn't set up yet: add BREVO_API_KEY and EMAIL_FROM in Edge Function secrets." }, 500);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const site = (Deno.env.get("SITE_URL") || "http://localhost:5173").replace(/\/+$/, "");
    const body = await request.json().catch(() => ({}));

    // ---- Who is calling? ----
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    const isTimer =
      cronSecret.length >= 16 && request.headers.get("x-cron-secret") === cronSecret;

    let onlyUser: string | null = null;

    if (!isTimer) {
      const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: auth } = await admin.auth.getUser(token);

      if (!auth?.user || body?.action !== "test") {
        return reply({ error: "Not allowed." }, 401);
      }

      onlyUser = auth.user.id;
    }

    // Timer: make "due soon" reminders for everyone first
    if (isTimer) {
      await admin.rpc("create_due_soon_reminders_all");
    }

    const { data: people, error: listError } =
      await admin.rpc("email_digest_list", { only_user: onlyUser });

    if (listError) {
      return reply({ error: "Run supabase/20-email-notifications.sql in Supabase first." }, 500);
    }

    if (onlyUser && (!people || people.length === 0)) {
      return reply({ sent: 0, message: "You have no unread notifications to email right now." });
    }

    let sent = 0;
    const failed: string[] = [];

    for (const person of people || []) {
      // Skip accounts the school turned off
      const { data: account } = await admin.auth.admin.getUserById(person.user_id);
      const bannedUntil = account?.user?.banned_until ? new Date(account.user.banned_until).getTime() : 0;
      if (bannedUntil > Date.now()) continue;

      const items = (person.items || []) as Item[];
      if (items.length === 0) continue;

      try {
        await sendWithBrevo(person.email, person.full_name, buildEmail(person.full_name, items, site));
        await admin.rpc("mark_notifications_emailed", { ids: items.map((item) => String(item.id)) });
        sent += 1;
      } catch (sendError) {
        failed.push(String((sendError as Error).message || sendError));
      }
    }

    if (onlyUser && failed.length) {
      return reply({ error: failed[0] }, 502);
    }

    return reply({ sent, failed: failed.length, ...(failed.length ? { firstError: failed[0] } : {}) });
  } catch (error) {
    return reply({ error: (error as Error).message || "Something went wrong." }, 500);
  }
});
