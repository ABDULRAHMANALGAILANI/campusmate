import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  LogOut,
  Pencil,
  Power,
  Search,
  Upload,
  UserPlus,
  Users,
  X,
  Trash2,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import { callSchoolAdmin } from "../../lib/schoolAdmin";

import {
  TEMPLATE_ROWS,
  checkPerson,
  downloadCsv,
  readPeopleCsv,
} from "../../lib/csv";

import "./SchoolAdmin.css";


// =========================================================
// SCHOOL ADMIN
// The school's own page: see everyone in the school, add
// students and professors one by one or from a CSV file,
// reset passwords and turn accounts off.
// =========================================================

const BATCH_SIZE = 50;

const EMPTY_PERSON = {
  full_name: "",
  email: "",
  role: "student",
  student_id: "",
  programme: "",
};


function formatDate(value) {
  if (!value) return "";

  return new Date(value).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}


function statusOf(person) {
  if (!person.active) return { key: "off", label: "Turned off" };
  if (person.must_change_password || !person.last_sign_in_at) {
    return { key: "waiting", label: "Not signed in yet" };
  }
  return { key: "active", label: "Active" };
}


function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the text is still on screen
    }
  }

  return (
    <button
      type="button"
      className="sa-icon-button"
      onClick={copy}
      aria-label={copied ? "Copied" : `${label} ${text}`}
      title={copied ? "Copied" : label}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}


function SchoolAdmin() {
  const navigate =
    useNavigate();

  const fileInput =
    useRef(null);

  const [adminName, setAdminName] = useState("");
  const [schoolName, setSchoolName] = useState("");

  const [people, setPeople] = useState([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [listError, setListError] = useState("");

  const [tab, setTab] = useState("people");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Add one person
  const [form, setForm] = useState(EMPTY_PERSON);
  const [formError, setFormError] = useState("");

  // CSV
  const [csvName, setCsvName] = useState("");
  const [csvPeople, setCsvPeople] = useState([]);
  const [csvProblem, setCsvProblem] = useState("");

  // Creating accounts (both ways)
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState(null);

  // Row actions
  const [busyId, setBusyId] = useState("");

  // Fixing a person's details
  const [editing, setEditing] = useState(null);
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [notice, setNotice] = useState(null);


  // ---------- Load ----------

  const loadPeople = useCallback(async () => {
    setLoadingPeople(true);
    setListError("");

    try {
      const data =
        await callSchoolAdmin("list");

      setPeople(data.people || []);
    } catch (error) {
      setListError(error.message);
    } finally {
      setLoadingPeople(false);
    }
  }, []);


  useEffect(() => {
    let active =
      true;

    async function loadHeader() {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user || !active) return;

      const { data: profile } =
        await supabase
          .from("profiles")
          .select("full_name, school_id")
          .eq("id", user.id)
          .maybeSingle();

      if (!active) return;

      setAdminName(profile?.full_name || user.email || "");

      if (profile?.school_id) {
        const { data: school } =
          await supabase
            .from("schools")
            .select("name")
            .eq("id", profile.school_id)
            .maybeSingle();

        if (active) setSchoolName(school?.name || "");
      }
    }

    loadHeader();
    loadPeople();

    return () => {
      active =
        false;
    };
  }, [loadPeople]);


  // ---------- Numbers ----------

  const counts = useMemo(() => {
    const students = people.filter((p) => p.role === "student").length;
    const professors = people.filter((p) => p.role === "professor").length;
    const waiting = people.filter(
      (p) => p.role !== "school_admin" && statusOf(p).key === "waiting"
    ).length;

    return { students, professors, waiting };
  }, [people]);


  const visiblePeople = useMemo(() => {
    const term =
      search.trim().toLowerCase();

    return people.filter((person) => {
      if (roleFilter !== "all" && person.role !== roleFilter) return false;
      if (!term) return true;

      return [
        person.full_name,
        person.email,
        person.campus_id,
        person.student_id,
        person.programme,
      ].some((value) => (value || "").toLowerCase().includes(term));
    });
  }, [people, search, roleFilter]);


  // ---------- Create accounts ----------

  async function createAccounts(list) {
    setCreating(true);
    setProgress({ done: 0, total: list.length });

    const all = [];

    for (let start = 0; start < list.length; start += BATCH_SIZE) {
      const batch =
        list.slice(start, start + BATCH_SIZE);

      try {
        const data =
          await callSchoolAdmin("create", {
            people: batch.map((person) => ({
              full_name: person.full_name,
              email: person.email,
              role: person.role,
              student_id: person.student_id,
              programme: person.programme,
            })),
          });

        all.push(...(data.results || []));
      } catch (error) {
        // Whole batch failed (e.g. connection): report each row.
        all.push(
          ...batch.map((person) => ({
            ...person,
            ok: false,
            error: error.message,
          }))
        );
      }

      setProgress({
        done: Math.min(start + BATCH_SIZE, list.length),
        total: list.length,
      });
    }

    setCreating(false);
    setResults(all);
    loadPeople();
  }


  async function handleAddOne(event) {
    event.preventDefault();

    const person = {
      ...form,
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
    };

    const problem =
      checkPerson(person);

    if (problem) {
      setFormError(problem);
      return;
    }

    setFormError("");
    await createAccounts([person]);
    setForm(EMPTY_PERSON);
  }


  function handleCsvFile(event) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    setCsvName(file.name);
    setCsvProblem("");
    setCsvPeople([]);

    const reader =
      new FileReader();

    reader.onload = () => {
      const {
        people: rows,
        problem,
      } =
        readPeopleCsv(String(reader.result || ""));

      setCsvProblem(problem);
      setCsvPeople(rows);
    };

    reader.onerror = () => {
      setCsvProblem("Couldn't read that file. Save it as CSV and try again.");
    };

    reader.readAsText(file);
  }


  const csvReady =
    csvPeople.filter((person) => !person.problem);

  const csvBroken =
    csvPeople.filter((person) => person.problem);


  function downloadPasswords() {
    const created =
      (results || []).filter((row) => row.ok);

    downloadCsv(
      `campusmate-new-accounts-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ["full_name", "email", "role", "campusmate_id", "temporary_password"],
        ...created.map((row) => [
          row.full_name,
          row.email,
          row.role,
          row.campus_id,
          row.temporary_password,
        ]),
      ]
    );
  }


  function closeResults() {
    setResults(null);
    setCsvPeople([]);
    setCsvName("");
    setTab("people");
  }


  // ---------- Row actions ----------

  function startEdit(person) {
    setNotice(null);
    setEditError("");
    setEditing({
      id: person.id,
      role: person.role,
      full_name: person.full_name || "",
      email: person.email || "",
      student_id: person.student_id || "",
      programme: person.programme || "",
    });
  }


  async function saveEdit(event) {
    event.preventDefault();

    const problem =
      checkPerson({ ...editing, email: editing.email.trim().toLowerCase(), full_name: editing.full_name.trim() });

    if (problem) {
      setEditError(problem);
      return;
    }

    setSavingEdit(true);
    setEditError("");

    try {
      await callSchoolAdmin("update_person", {
        user_id: editing.id,
        full_name: editing.full_name.trim(),
        email: editing.email.trim().toLowerCase(),
        student_id: editing.student_id,
        programme: editing.programme,
      });

      setNotice({ type: "info", message: `${editing.full_name.trim()}'s details are saved.` });
      setEditing(null);
      loadPeople();
    } catch (error) {
      setEditError(error.message);
    } finally {
      setSavingEdit(false);
    }
  }


  async function resetPassword(person) {
    const confirmed =
      window.confirm(
        `Give ${person.full_name} a new temporary password? Their current password will stop working.`
      );

    if (!confirmed) return;

    setBusyId(person.id);
    setNotice(null);

    try {
      const data =
        await callSchoolAdmin("reset_password", { user_id: person.id });

      setNotice({
        type: "password",
        person,
        password: data.temporary_password,
      });

      loadPeople();
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setBusyId("");
    }
  }


  // PDPA: remove someone and all their data (can't be undone)
  async function deletePerson(person) {
    const typed =
      window.prompt(
        `Delete ${person.full_name} and ALL their data (hand-ins, marks, attendance, messages)? This can't be undone. To leave them signed out but keep their records, use Turn off instead.\n\nType DELETE to confirm.`
      );

    if (typed === null) return;

    if (typed.trim() !== "DELETE") {
      setNotice({ type: "error", message: "Not deleted: you didn't type DELETE." });
      return;
    }

    setBusyId(person.id);
    setNotice(null);

    try {
      await callSchoolAdmin("delete_person", {
        user_id: person.id,
        confirm: "DELETE",
      });

      setNotice({ type: "info", message: `${person.full_name} and their data were deleted.` });
      loadPeople();
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setBusyId("");
    }
  }


  async function toggleActive(person) {
    const turningOff =
      person.active;

    if (turningOff) {
      const confirmed =
        window.confirm(
          `Turn off ${person.full_name}'s account? They won't be able to sign in until you turn it back on. Nothing is deleted.`
        );

      if (!confirmed) return;
    }

    setBusyId(person.id);
    setNotice(null);

    try {
      await callSchoolAdmin("set_active", {
        user_id: person.id,
        active: !turningOff,
      });

      setNotice({
        type: "info",
        message: turningOff
          ? `${person.full_name}'s account is turned off.`
          : `${person.full_name} can sign in again.`,
      });

      loadPeople();
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setBusyId("");
    }
  }


  async function logOut() {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }


  // ---------- Results view ----------

  function renderResults() {
    const created = results.filter((row) => row.ok);
    const failed = results.filter((row) => !row.ok);

    return (
      <section className="sa-card" aria-labelledby="sa-results-title">
        <div className="sa-card-head">
          <div>
            <h2 id="sa-results-title">
              {created.length === 1
                ? "1 account created"
                : `${created.length} accounts created`}
            </h2>
            {created.length > 0 && (
              <p>
                Give each person their email and temporary password.
                They'll choose their own password the first time they sign in.
              </p>
            )}
          </div>
        </div>

        {created.length > 0 && (
          <>
            <p className="sa-warning">
              <KeyRound size={16} aria-hidden="true" />
              These passwords are shown only now. Download or copy them
              before you leave this page.
            </p>

            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>CampusMate ID</th>
                    <th>Temporary password</th>
                  </tr>
                </thead>
                <tbody>
                  {created.map((row) => (
                    <tr key={row.email}>
                      <td data-label="Name">
                        <strong>{row.full_name}</strong>
                        <span className="sa-muted sa-role-tag">{row.role}</span>
                      </td>
                      <td data-label="Email">{row.email}</td>
                      <td data-label="CampusMate ID">{row.campus_id || "—"}</td>
                      <td data-label="Temporary password">
                        <span className="sa-password">
                          <code>{row.temporary_password}</code>
                          <CopyButton
                            text={row.temporary_password}
                            label="Copy password"
                          />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {failed.length > 0 && (
          <div className="sa-failed">
            <h3>
              {failed.length === 1
                ? "1 person wasn't added"
                : `${failed.length} people weren't added`}
            </h3>
            <ul>
              {failed.map((row, index) => (
                <li key={`${row.email}-${index}`}>
                  <strong>{row.full_name || row.email || "Unnamed"}</strong>
                  {row.email && row.full_name ? ` (${row.email})` : ""}: {row.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="sa-actions">
          {created.length > 0 && (
            <button
              type="button"
              className="sa-button primary"
              onClick={downloadPasswords}
            >
              <Download size={17} aria-hidden="true" />
              Download passwords (CSV)
            </button>
          )}

          <button
            type="button"
            className="sa-button"
            onClick={closeResults}
          >
            Done
          </button>
        </div>
      </section>
    );
  }


  // ---------- Page ----------

  return (
    <div className="sa-page">

      <header className="sa-topbar">
        <div className="sa-brand">
          <GraduationCap size={22} aria-hidden="true" />
          <span>CampusMate</span>
          <span className="sa-badge">School admin</span>
        </div>

        <div className="sa-topbar-right">
          <span className="sa-admin-name">{adminName}</span>

          <button
            type="button"
            className="sa-button ghost"
            onClick={logOut}
          >
            <LogOut size={16} aria-hidden="true" />
            Log out
          </button>
        </div>
      </header>


      <main className="sa-main">

        <div className="sa-heading">
          <h1>{schoolName || "Your school"}</h1>
          <p>Create and manage CampusMate accounts for your students and professors.</p>
        </div>


        <div className="sa-stats">
          <div className="sa-stat">
            <span>Students</span>
            <strong>{loadingPeople ? "–" : counts.students}</strong>
          </div>
          <div className="sa-stat">
            <span>Professors</span>
            <strong>{loadingPeople ? "–" : counts.professors}</strong>
          </div>
          <div className="sa-stat">
            <span>Not signed in yet</span>
            <strong>{loadingPeople ? "–" : counts.waiting}</strong>
          </div>
        </div>


        {results ? (
          renderResults()
        ) : (
          <>
            <div className="sa-tabs" role="tablist" aria-label="School admin">
              {[
                { id: "people", label: "People", icon: Users },
                { id: "add", label: "Add a person", icon: UserPlus },
                { id: "csv", label: "Upload a CSV", icon: FileSpreadsheet },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? "active" : ""}
                  onClick={() => setTab(id)}
                >
                  <Icon size={17} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>


            {/* ---------------- PEOPLE ---------------- */}
            {tab === "people" && (
              <section className="sa-card" aria-label="People">

                {editing && (
                  <form className="sa-edit" onSubmit={saveEdit} noValidate>
                    <div className="sa-edit-head">
                      <strong>Edit {editing.role === "professor" ? "professor" : "student"}</strong>
                      <button
                        type="button"
                        className="sa-icon-button"
                        onClick={() => setEditing(null)}
                        aria-label="Close"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {editError && <p className="sa-notice error" role="alert">{editError}</p>}

                    <div className="sa-field-row">
                      <label className="sa-field">
                        <span>Full name</span>
                        <input
                          value={editing.full_name}
                          onChange={(event) => setEditing({ ...editing, full_name: event.target.value })}
                          autoFocus
                        />
                      </label>

                      <label className="sa-field">
                        <span>Email (they sign in with this)</span>
                        <input
                          type="email"
                          value={editing.email}
                          onChange={(event) => setEditing({ ...editing, email: event.target.value })}
                        />
                      </label>
                    </div>

                    <div className="sa-field-row">
                      {editing.role === "student" && (
                        <label className="sa-field">
                          <span>Student ID <em>(optional)</em></span>
                          <input
                            value={editing.student_id}
                            onChange={(event) => setEditing({ ...editing, student_id: event.target.value })}
                          />
                        </label>
                      )}

                      <label className="sa-field">
                        <span>{editing.role === "student" ? "Programme" : "Department"} <em>(optional)</em></span>
                        <input
                          value={editing.programme}
                          onChange={(event) => setEditing({ ...editing, programme: event.target.value })}
                        />
                      </label>
                    </div>

                    <p className="sa-muted">
                      Changing the email changes what they sign in with. Their password stays the same.
                    </p>

                    <div className="sa-actions">
                      <button type="submit" className="sa-button primary" disabled={savingEdit}>
                        {savingEdit ? "Saving..." : "Save changes"}
                      </button>
                      <button type="button" className="sa-button" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {notice?.type === "password" && (
                  <div className="sa-notice success" role="status">
                    <div>
                      <strong>New temporary password for {notice.person.full_name}</strong>
                      <span className="sa-password">
                        <code>{notice.password}</code>
                        <CopyButton text={notice.password} label="Copy password" />
                      </span>
                      <small>
                        Shown only now. They'll choose their own password when they sign in.
                      </small>
                    </div>
                    <button
                      type="button"
                      className="sa-icon-button"
                      onClick={() => setNotice(null)}
                      aria-label="Close"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {(notice?.type === "info" || notice?.type === "error") && (
                  <div
                    className={`sa-notice ${notice.type === "error" ? "error" : "success"}`}
                    role={notice.type === "error" ? "alert" : "status"}
                  >
                    <span>{notice.message}</span>
                    <button
                      type="button"
                      className="sa-icon-button"
                      onClick={() => setNotice(null)}
                      aria-label="Close"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                <div className="sa-toolbar">
                  <label className="sa-search">
                    <Search size={17} aria-hidden="true" />
                    <span className="sa-sr-only">Search people</span>
                    <input
                      type="search"
                      placeholder="Search name, email or ID"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>

                  <div className="sa-filter" role="group" aria-label="Show">
                    {[
                      ["all", "Everyone"],
                      ["student", "Students"],
                      ["professor", "Professors"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={roleFilter === value ? "active" : ""}
                        aria-pressed={roleFilter === value}
                        onClick={() => setRoleFilter(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {listError && (
                  <div className="sa-notice error" role="alert">
                    <span>{listError}</span>
                    <button type="button" className="sa-button small" onClick={loadPeople}>
                      Try again
                    </button>
                  </div>
                )}

                {loadingPeople ? (
                  <p className="sa-empty">Loading people...</p>
                ) : visiblePeople.length === 0 && !listError ? (
                  <div className="sa-empty">
                    {people.length <= 1 ? (
                      <>
                        <p><strong>No students or professors yet.</strong></p>
                        <p>Add people one by one, or upload a CSV file with everyone at once.</p>
                        <div className="sa-actions center">
                          <button type="button" className="sa-button primary" onClick={() => setTab("add")}>
                            <UserPlus size={17} aria-hidden="true" />
                            Add a person
                          </button>
                          <button type="button" className="sa-button" onClick={() => setTab("csv")}>
                            <Upload size={17} aria-hidden="true" />
                            Upload a CSV
                          </button>
                        </div>
                      </>
                    ) : (
                      <p>No one matches your search.</p>
                    )}
                  </div>
                ) : (
                  <div className="sa-table-wrap">
                    <table className="sa-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Role</th>
                          <th>CampusMate ID</th>
                          <th>Status</th>
                          <th><span className="sa-sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {visiblePeople.map((person) => {
                          const status = statusOf(person);
                          const isAdmin = person.role === "school_admin";
                          const busy = busyId === person.id;

                          return (
                            <tr key={person.id}>
                              <td data-label="Name">
                                <strong>{person.full_name || "No name"}</strong>
                                <span className="sa-muted">{person.email}</span>
                                {(person.student_id || person.programme) && (
                                  <span className="sa-muted">
                                    {[person.student_id, person.programme].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                              </td>
                              <td data-label="Role" className="sa-capitalize">
                                {isAdmin ? "School admin" : person.role}
                              </td>
                              <td data-label="CampusMate ID">{person.campus_id || "—"}</td>
                              <td data-label="Status">
                                {isAdmin ? (
                                  <span className="sa-status active">You</span>
                                ) : (
                                  <span className={`sa-status ${status.key}`}>
                                    {status.label}
                                  </span>
                                )}
                                {person.created_at && (
                                  <span className="sa-muted">Added {formatDate(person.created_at)}</span>
                                )}
                              </td>
                              <td className="sa-row-actions">
                                {!isAdmin && (
                                  <>
                                    <button
                                      type="button"
                                      className="sa-button small"
                                      onClick={() => startEdit(person)}
                                      disabled={busy}
                                    >
                                      <Pencil size={15} aria-hidden="true" />
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="sa-button small"
                                      onClick={() => resetPassword(person)}
                                      disabled={busy || !person.active}
                                    >
                                      <KeyRound size={15} aria-hidden="true" />
                                      Reset password
                                    </button>
                                    <button
                                      type="button"
                                      className={`sa-button small ${person.active ? "danger" : ""}`}
                                      onClick={() => toggleActive(person)}
                                      disabled={busy}
                                    >
                                      <Power size={15} aria-hidden="true" />
                                      {person.active ? "Turn off" : "Turn on"}
                                    </button>
                                    <button
                                      type="button"
                                      className="sa-button small danger"
                                      onClick={() => deletePerson(person)}
                                      disabled={busy}
                                      title="Delete this person and all their data"
                                    >
                                      <Trash2 size={15} aria-hidden="true" />
                                      Delete
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}


            {/* ---------------- ADD ONE ---------------- */}
            {tab === "add" && (
              <section className="sa-card" aria-labelledby="sa-add-title">
                <div className="sa-card-head">
                  <div>
                    <h2 id="sa-add-title">Add a person</h2>
                    <p>
                      CampusMate makes a temporary password for them. You'll see it
                      on the next screen.
                    </p>
                  </div>
                </div>

                <form className="sa-form" onSubmit={handleAddOne} noValidate>
                  {formError && (
                    <p className="sa-notice error" role="alert">{formError}</p>
                  )}

                  <fieldset className="sa-role-choice">
                    <legend>They are a</legend>
                    {["student", "professor"].map((role) => (
                      <label key={role} className={form.role === role ? "active" : ""}>
                        <input
                          type="radio"
                          name="role"
                          value={role}
                          checked={form.role === role}
                          onChange={() => setForm({ ...form, role })}
                        />
                        {role === "student" ? "Student" : "Professor"}
                      </label>
                    ))}
                  </fieldset>

                  <label className="sa-field">
                    <span>Full name</span>
                    <input
                      value={form.full_name}
                      onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                      placeholder={form.role === "professor" ? "e.g. Dr Tan Wei Ming" : "e.g. Aisha Rahman"}
                      autoComplete="off"
                      required
                    />
                  </label>

                  <label className="sa-field">
                    <span>Email (they'll sign in with this)</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm({ ...form, email: event.target.value })}
                      placeholder="name@yourschool.edu.my"
                      autoComplete="off"
                      required
                    />
                  </label>

                  <div className="sa-field-row">
                    {form.role === "student" && (
                      <label className="sa-field">
                        <span>Student ID <em>(optional)</em></span>
                        <input
                          value={form.student_id}
                          onChange={(event) => setForm({ ...form, student_id: event.target.value })}
                          placeholder="e.g. S2026001"
                          autoComplete="off"
                        />
                      </label>
                    )}

                    <label className="sa-field">
                      <span>{form.role === "student" ? "Programme" : "Department"} <em>(optional)</em></span>
                      <input
                        value={form.programme}
                        onChange={(event) => setForm({ ...form, programme: event.target.value })}
                        placeholder="e.g. Computer Science"
                        autoComplete="off"
                      />
                    </label>
                  </div>

                  <div className="sa-actions">
                    <button
                      type="submit"
                      className="sa-button primary"
                      disabled={creating}
                    >
                      <UserPlus size={17} aria-hidden="true" />
                      {creating ? "Creating account..." : "Create account"}
                    </button>
                  </div>
                </form>
              </section>
            )}


            {/* ---------------- CSV ---------------- */}
            {tab === "csv" && (
              <section className="sa-card" aria-labelledby="sa-csv-title">
                <div className="sa-card-head">
                  <div>
                    <h2 id="sa-csv-title">Upload a CSV</h2>
                    <p>Add many students and professors at once from a spreadsheet.</p>
                  </div>
                </div>

                <ol className="sa-steps">
                  <li>
                    <div>
                      <strong>Download the template</strong>
                      <p>
                        One person per row. <code>full_name</code> and <code>email</code> are
                        required; <code>role</code> is student or professor (blank = student).
                      </p>
                    </div>
                    <button
                      type="button"
                      className="sa-button"
                      onClick={() => downloadCsv("campusmate-people-template.csv", TEMPLATE_ROWS)}
                    >
                      <Download size={17} aria-hidden="true" />
                      Template
                    </button>
                  </li>

                  <li>
                    <div>
                      <strong>Fill it in and save as CSV</strong>
                      <p>In Excel: File → Save As → <em>CSV UTF-8 (Comma delimited)</em>.</p>
                    </div>
                  </li>

                  <li>
                    <div>
                      <strong>Choose your file</strong>
                      <p>{csvName ? `Selected: ${csvName}` : "We'll check it before creating any accounts."}</p>
                    </div>
                    <button
                      type="button"
                      className="sa-button primary"
                      onClick={() => fileInput.current?.click()}
                      disabled={creating}
                    >
                      <Upload size={17} aria-hidden="true" />
                      Choose file
                    </button>
                    <input
                      ref={fileInput}
                      type="file"
                      accept=".csv,text/csv"
                      className="sa-sr-only"
                      tabIndex={-1}
                      onChange={handleCsvFile}
                    />
                  </li>
                </ol>

                {csvProblem && (
                  <p className="sa-notice error" role="alert">{csvProblem}</p>
                )}

                {csvPeople.length > 0 && (
                  <>
                    <div className="sa-csv-summary">
                      <span className="sa-status active">{csvReady.length} ready</span>
                      {csvBroken.length > 0 && (
                        <span className="sa-status off">
                          {csvBroken.length} with problems (will be skipped)
                        </span>
                      )}
                    </div>

                    <div className="sa-table-wrap sa-preview">
                      <table className="sa-table">
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Check</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvPeople.map((person) => (
                            <tr key={person.line} className={person.problem ? "has-problem" : ""}>
                              <td data-label="Row">{person.line}</td>
                              <td data-label="Name">{person.full_name || "—"}</td>
                              <td data-label="Email">{person.email || "—"}</td>
                              <td data-label="Role" className="sa-capitalize">{person.role}</td>
                              <td data-label="Check">
                                {person.problem ? (
                                  <span className="sa-problem">{person.problem}</span>
                                ) : (
                                  <span className="sa-ok"><Check size={15} aria-hidden="true" /> OK</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="sa-actions">
                      <button
                        type="button"
                        className="sa-button primary"
                        disabled={creating || csvReady.length === 0}
                        onClick={() => createAccounts(csvReady)}
                      >
                        <UserPlus size={17} aria-hidden="true" />
                        {creating
                          ? `Creating ${progress.done} of ${progress.total}...`
                          : `Create ${csvReady.length} ${csvReady.length === 1 ? "account" : "accounts"}`}
                      </button>
                      <button
                        type="button"
                        className="sa-button"
                        disabled={creating}
                        onClick={() => {
                          setCsvPeople([]);
                          setCsvName("");
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}
          </>
        )}

      </main>
    </div>
  );
}

export default SchoolAdmin;
