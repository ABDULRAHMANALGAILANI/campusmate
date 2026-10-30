import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useSearchParams,
} from "react-router-dom";

import {
  BookOpen,
  FileText,
  ListChecks,
  Megaphone,
  MessageCircleQuestion,
  Paperclip,
  Search as SearchIcon,
} from "lucide-react";

import { supabase } from "../lib/supabase";

import Sidebar from "../components/Sidebar";
import ProfessorSidebar from "../components/ProfessorSidebar";
import NotificationBell from "../components/NotificationBell";

import "./Search.css";


// =========================================================
// SEARCH
// Finds classes, announcements, materials (and file names),
// assignments, questions and quizzes in every class you are in.
// =========================================================

const KINDS = {
  class: { label: "Class", icon: BookOpen, tab: "" },
  announcement: { label: "Announcement", icon: Megaphone, tab: "" },
  material: { label: "Material", icon: Paperclip, tab: "" },
  assignment: { label: "Assignment", icon: FileText, tab: "" },
  question: { label: "Question", icon: MessageCircleQuestion, tab: "qa" },
  quiz: { label: "Quiz", icon: ListChecks, tab: "quizzes" },
};


function Highlight({ text, query }) {
  if (!text) return null;

  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0 || !query) return text;

  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}


function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [role, setRole] = useState("");
  const [results, setResults] = useState([]);
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } =
        await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      if (active) setRole(profile?.role || "student");
    });

    return () => {
      active = false;
    };
  }, []);

  // Search 300 ms after typing stops
  useEffect(() => {
    const text = query.trim();

    const timer = window.setTimeout(async () => {
      setParams(text ? { q: text } : {}, { replace: true });

      if (text.length < 2) {
        setResults([]);
        setState("idle");
        return;
      }

      setState("loading");
      setError("");

      const { data, error: searchError } =
        await supabase.rpc("search_campusmate", { input_query: text });

      if (searchError) {
        setError(
          /search_campusmate|schema cache/i.test(searchError.message)
            ? "Search isn't set up yet. Run supabase/14-real-classroom.sql in Supabase."
            : searchError.message
        );
        setResults([]);
        setState("done");
        return;
      }

      setResults(data || []);
      setState("done");
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, setParams]);

  const Nav =
    role === "professor" ? ProfessorSidebar : Sidebar;

  const text =
    query.trim();

  return (
    <div className="search-page">
      {role && <Nav />}

      <main className={`search-main ${role === "professor" ? "professor" : "student"}`}>
        <header className="search-topbar">
          <label className="search-box">
            <SearchIcon size={19} aria-hidden="true" />
            <span className="search-sr-only">Search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search classes, files, assignments, questions..."
              autoFocus
            />
          </label>
          <NotificationBell showSearch={false} />
        </header>

        <div className="search-content">
          <h1>Search</h1>

          {error && <p className="search-error" role="alert">{error}</p>}

          {state === "idle" && (
            <p className="search-hint">
              Type at least 2 letters. Searches every class you are in: announcements, materials and
              file names, assignments, questions and quizzes.
            </p>
          )}

          {state === "loading" && <p className="search-hint">Searching...</p>}

          {state === "done" && !error && results.length === 0 && (
            <p className="search-hint">Nothing found for “{text}”.</p>
          )}

          {results.length > 0 && (
            <ul className="search-results" aria-live="polite">
              {results.map((row) => {
                const kind = KINDS[row.kind] || KINDS.class;
                const Icon = kind.icon;
                const link = kind.tab ? `${row.link}?tab=${kind.tab}` : row.link;

                return (
                  <li key={`${row.kind}-${row.item_id}`}>
                    <Link to={link}>
                      <span className={`search-icon ${row.kind}`}>
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <span className="search-text">
                        <strong><Highlight text={row.title} query={text} /></strong>
                        {row.snippet && <small><Highlight text={row.snippet} query={text} /></small>}
                        <em>
                          {kind.label} · {row.class_label}
                          {row.created_at ? ` · ${new Date(row.created_at).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}` : ""}
                        </em>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

export default SearchPage;
