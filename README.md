# CampusMate

A campus companion web app for students and professors, built with React, Vite and Supabase.

## Features

**Students:** dashboard with To do, course pages (announcements, materials, class times, assignments with question sheets, hand-ins, quizzes, Q&A, grades with total so far, attendance with MC/absence excuses), schedule with class deadlines and weekly class times, search across all classes, group projects, friends and chat, fingerprint/face sign-in, install on the phone ("Add to Home screen").

**Professors:** dashboard with To mark, course pages (announcements, materials, class times, assignments/tests/exams with files, editing, weights, marks hidden until released, gradebook with final total and letter grade, quizzes marked automatically, Q&A, attendance report and excuses), add a whole class list at once (paste or CSV), co-lecturers and tutors, attendance by QR code (each code works 30 seconds), chat and meetings, project teams and feedback.

**School admins:** create student and professor accounts one by one or from a CSV file.

## Tech stack

- [React 19](https://react.dev) + [Vite](https://vite.dev)
- [Supabase](https://supabase.com) for authentication, database, file storage and realtime updates
- React Router, Lucide icons, qrcode.react, emoji-picker-react, MediaPipe (blink check for face sign-in)

## Getting started

1. Install [Node.js](https://nodejs.org) (version 20 or newer).
2. Install dependencies:
   ```
   npm install
   ```
3. Create your environment file:
   ```
   copy .env.example .env      (Windows)
   cp .env.example .env        (Mac/Linux)
   ```
   Then fill in the values from Supabase Dashboard -> Project Settings -> API.
4. Start the development server:
   ```
   npm run dev
   ```
   and open the link it prints (usually http://localhost:5173).

## Languages, help and privacy

- Language switch (English, Bahasa Melayu, Türkçe, العربية) on the sign-in pages, in the account menu, the phone "More" menu and Settings. Arabic shows right to left.
- Translations are in `src/i18n/<language>.json` as `"English text": "translation"`. Entries with `{0}` match text with numbers, e.g. `"{0}/{1} handed in"`.
- Help page (`/help`) with guides and "Report a problem". Reports are saved in the `problem_reports` table (read them in Supabase Table Editor).
- Semesters: the class owner can set a semester and archive a class at the end of it. Archived classes are read-only and hidden under "Show past classes".
- Needs attention card (teachers) on each class, and an Activity tab that records changes to marks, due dates, attendance and the class list.
- Daily email with unread notifications (Brevo), on/off in Settings.
- Privacy Notice (`/privacy`). Everyone agrees once before using CampusMate. **Edit `src/config/legal.js`** with your real name and contact email before real students use it. Change `PRIVACY_VERSION` there when the notice changes, and everyone is asked again.

## Database setup (Supabase SQL Editor)

Run these once, in this order (each is safe to run again):

| File | Adds |
| --- | --- |
| `7-create-school.sql` | A school and its school admin |
| `8-fix-new-user.sql` | Fix for creating users |
| `9-course-pages.sql` | Course pages, hand-ins, file stores |
| `11-fix-attendance-ambiguous.sql` | Attendance fix |
| `10-attendance-qr.sql` | 30-second QR attendance |
| `12-notifications.sql` | Automatic notifications |
| `13-late-work-and-reminders.sql` | Late hand-in rule, due-soon reminders |
| `14-real-classroom.sql` | Edit assignments, files on assignments, add many students, co-lecturers/tutors, weights + release marks, absence excuses, Q&A, class times, quizzes, search |
| `15-privacy-and-help.sql` | Privacy Notice agreement (PDPA) and "Report a problem" |
| `16-my-data.sql` | Download my data, delete my account (school admins can delete people too) |
| `17-cleanup-old-tables.sql` | Removes old, unused tables (keeps any that still have data as `old_...`) |
| `18-semesters-and-activity.sql` | Semesters, archive a class (read-only), activity log |
| `19-longer-ids.sql` | 10-digit CampusMate IDs (`STU-2026000001`, `PRO-2026000001`); converts existing IDs |
| `20-email-notifications.sql` | Daily email of notifications (on/off in Settings) |
| `21-schedule-daily-email.sql` | Sends the daily email at 7am (edit the two values in the SQL Editor first) |

Deploy as Edge Functions (Verify JWT off for both):
- `supabase/functions/school-admin`
- `supabase/functions/send-daily-email`, with secrets `BREVO_API_KEY`, `EMAIL_FROM`, `SITE_URL`, `CRON_SECRET`

## Scripts

| Command           | What it does                              |
| ----------------- | ----------------------------------------- |
| `npm run dev`     | Start the local development server        |
| `npm run build`   | Build the production site into `dist/`    |
| `npm run preview` | Preview the production build locally      |
| `npm run lint`    | Check the code for problems               |

## Project structure

```
src/
  App.jsx              Routes; pages are lazy-loaded on demand
  lib/                 Supabase client and helpers (files, marks, grades)
  components/          Sidebars, route protection, avatars, notifications
  pages/               Student pages, Search
  pages/Course/        Course page and its tabs
  pages/Professor/     Professor pages
public/                Icons, manifest and service worker (installable app)
supabase/              SQL files and the school-admin Edge Function
```

## Security notes

- Professor pages are restricted to users whose `profiles.role` is `professor`.
- Real data protection comes from Supabase Row Level Security (RLS) policies on every table. The app's page checks are for navigation only.
- Users cannot change their own role (enforced by a database trigger).
- Marks are stored in `assignment_marks`; students can only read their own, and only after the professor releases them.
- Quiz answers live in `quiz_questions`, which students can't read. Quizzes are started, handed in and marked by database functions, and correct answers are shown only after the quiz closes.
- Co-lecturers and tutors get the same access as the class owner, except deleting the class and managing teachers.
