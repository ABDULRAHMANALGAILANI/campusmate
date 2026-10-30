import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useLocation,
} from "react-router-dom";

import {
  BookOpen,
  ChevronDown,
  GraduationCap,
  LifeBuoy,
  Send,
  ShieldCheck,
  UserCog,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import { useAccount } from "../../lib/account";
import { CONTACT_EMAIL } from "../../config/legal";

import InfoLayout from "./InfoLayout";


// =========================================================
// HELP
// Short guides for students, professors and school admins,
// and a "Report a problem" form (saved in problem_reports).
// =========================================================

const GUIDES = {
  student: {
    title: "For students",
    icon: GraduationCap,
    items: [
      ["Join a class", "Ask your professor for the class code or QR code. Go to My Class, enter the code and press Join. If your school added you, the class is already there."],
      ["Hand in an assignment", "Open the class and find the assignment under Assignments, tests and exams. Choose your file and press Hand in. You can change it until the deadline, unless your professor has already marked it."],
      ["Check in to a class", "When your professor shows a QR code, open your phone camera and scan it while you are signed in. Each code works for 30 seconds."],
      ["Missed a class?", "Open the class, go to Attendance and press Excuse next to the absence. Write the reason and attach your MC. Accepted excuses don't count against your attendance."],
      ["See your marks", "Open the class and go to Grades. Marks appear after your professor releases them. Your total so far uses the weights your professor set."],
      ["Take a quiz", "Open the class, go to Quizzes and press Start quiz. If there is a time limit, the timer starts straight away and your answers are handed in when the time runs out."],
      ["Ask a question", "Use the Q&A tab of the class, so everyone in the class gets the answer."],
      ["Sign in with fingerprint or face", "Go to Settings and press Set up this device. Do this once on each phone or computer."],
      ["Daily email", "Each morning you get one email with anything new. Turn it off in Settings under Email notifications."],
      ["Where are my old classes?", "Classes from past semesters are archived. On My Class, tick Show past classes to see their marks and files."],
    ],
  },
  professor: {
    title: "For professors",
    icon: BookOpen,
    items: [
      ["Create a class and add students", "Go to My Classes and create a class. Open it, go to Participants and paste your class list (CampusMate IDs, matric numbers or emails), or share the join code."],
      ["Post an assignment, test or exam", "Open the class and press New under Assignments, tests and exams. Choose Students hand in work or Mark only, attach the question sheet and set the weight."],
      ["Mark work and release marks", "Open the assignment, type each mark and feedback and press Save. Students only see their marks after you press Release marks."],
      ["Take attendance", "Go to Attendance, choose the class and press Start Attendance, then Generate QR. Each QR works for 30 seconds. Press Close Attendance when you finish."],
      ["Check absence excuses", "Open the class and go to Attendance. Accept or reject each excuse. Accepted absences don't count against the 80% rule."],
      ["Add a co-lecturer or tutor", "Open the class, go to Participants and enter their CampusMate ID (PRO-…) or email. Only the professor who owns the class can do this."],
      ["Work out the final grade", "Give every assignment and quiz a weight. The Grades tab adds them up and shows the letter grade. Use Download CSV to export it."],
      ["Make a quiz", "Open the class, go to Quizzes and press New quiz. Add questions, tick the correct answers, then press Publish. Quizzes are marked automatically."],
      ["End of semester", "Open the class and press Archive class at the bottom of General. It becomes read-only and moves to past classes. Everything is kept, and you can un-archive it."],
      ["See who changed what", "Open the class and go to Activity. Every change to marks, due dates, attendance and the class list is recorded there."],
    ],
  },
  school_admin: {
    title: "For school admins",
    icon: UserCog,
    items: [
      ["Create accounts", "Go to School admin and add people one by one, or upload a CSV file. Give each person their email and temporary password."],
      ["Someone forgot their password", "Use Reset password next to their name, or they can use Forgot password? on the sign-in page."],
      ["Someone left the school", "Use Turn off next to their name. They can no longer sign in, and their records stay for the school."],
    ],
  },
};

const CATEGORIES = [
  ["bug", "Something isn't working"],
  ["marks", "Wrong mark or attendance"],
  ["account", "Account or sign-in"],
  ["privacy", "Privacy or my data"],
  ["idea", "Idea or suggestion"],
];

const STATUS_TEXT = {
  open: "Sent",
  in_progress: "Being looked at",
  fixed: "Fixed",
  closed: "Closed",
};


function Guide({ guide }) {
  const Icon = guide.icon;

  return (
    <section className="info-section">
      <h2><Icon size={20} aria-hidden="true" /> {guide.title}</h2>
      <div className="info-faq">
        {guide.items.map(([question, answer]) => (
          <details key={question}>
            <summary>
              <span>{question}</span>
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}


function ReportForm({ user }) {
  const location = useLocation();
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(location.state?.from || "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    let active = true;

    supabase
      .from("problem_reports")
      .select("id, category, message, status, reply, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (active) setReports(data || []);
      });

    return () => {
      active = false;
    };
  }, [user.id, sent]);

  async function send(event) {
    event.preventDefault();
    setError("");

    if (message.trim().length < 5) {
      setError("Tell us what happened in a few words.");
      return;
    }

    setSending(true);

    const { error: insertError } =
      await supabase
        .from("problem_reports")
        .insert({
          user_id: user.id,
          category,
          message: message.trim(),
          page: page.trim() || null,
          device: navigator.userAgent.slice(0, 300),
        });

    setSending(false);

    if (insertError) {
      setError(
        /problem_reports|schema cache/i.test(insertError.message)
          ? "Reports aren't set up yet. Run supabase/15-privacy-and-help.sql in Supabase."
          : insertError.message
      );
      return;
    }

    setMessage("");
    setSent(true);
  }

  return (
    <>
      {sent ? (
        <div className="info-success" role="status">
          <strong>Thanks. Your report was sent.</strong>
          <span>We'll look at it soon. You can see its progress below.</span>
          <button type="button" className="info-button" onClick={() => setSent(false)}>Send another</button>
        </div>
      ) : (
        <form className="info-form" onSubmit={send}>
          <label className="info-field">
            <span>What kind of problem?</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="info-field">
            <span>What happened?</span>
            <textarea
              rows={5}
              maxLength={4000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="What were you trying to do, and what went wrong?"
            />
          </label>

          <label className="info-field">
            <span>Which page or class? <em>(optional)</em></span>
            <input value={page} maxLength={300} onChange={(event) => setPage(event.target.value)} placeholder="e.g. CPT113 Grades" />
          </label>

          {error && <p className="info-error" role="alert">{error}</p>}

          <button type="submit" className="info-button primary" disabled={sending}>
            <Send size={16} aria-hidden="true" />
            {sending ? "Sending..." : "Send report"}
          </button>
        </form>
      )}

      {reports.length > 0 && (
        <div className="info-reports">
          <h3>Your recent reports</h3>
          <ul>
            {reports.map((report) => (
              <li key={report.id}>
                <span className={`info-status ${report.status}`}>{STATUS_TEXT[report.status] || report.status}</span>
                <p data-no-translate>{report.message}</p>
                {report.reply && <p className="info-reply" data-no-translate>{report.reply}</p>}
                <small>{new Date(report.created_at).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}


function Help() {
  const account = useAccount();
  const location = useLocation();

  useEffect(() => {
    if (location.hash === "#report" && !account.loading) {
      document.getElementById("report")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [location.hash, account.loading]);

  const order =
    account.role === "professor"
      ? ["professor", "student"]
      : account.role === "school_admin"
        ? ["school_admin", "professor", "student"]
        : account.user
          ? ["student"]
          : ["student", "professor", "school_admin"];

  return (
    <InfoLayout account={account}>
      <article className="info-article">
        <div className="info-hero">
          <span className="info-hero-icon"><LifeBuoy size={26} aria-hidden="true" /></span>
          <div>
            <h1>Help</h1>
            <p>Short guides for the things people do most. Click a question to see the answer.</p>
          </div>
        </div>

        {order.map((key) => (
          <Guide key={key} guide={GUIDES[key]} />
        ))}

        <section className="info-section" id="report">
          <h2><Send size={20} aria-hidden="true" /> Report a problem</h2>
          <p>Something not working, a wrong mark, or a question about your data? Tell us here.</p>

          {account.loading ? null : account.user ? (
            <ReportForm user={account.user} />
          ) : (
            <p>
              <Link to="/">Sign in</Link> <span>to send a report, or email</span>{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} data-no-translate>{CONTACT_EMAIL}</a>
            </p>
          )}
        </section>

        <p className="info-footnote">
          <ShieldCheck size={16} aria-hidden="true" />
          <Link to="/privacy">Privacy Notice</Link>
        </p>
      </article>
    </InfoLayout>
  );
}

export default Help;
