import { useState } from "react";

import {
  Clock,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

import {
  DAY_NAMES,
  formatClock,
} from "../../lib/courseHelpers";


// =========================================================
// CLASS TIMES (day, time, room) on the course page.
// Also shown every week in students' Schedule.
// =========================================================

function AddMeeting({ groupId, onDone, onCancel }) {
  const [day, setDay] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");
  const [room, setRoom] = useState("");
  const [kind, setKind] = useState("Lecture");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    setError("");

    if (!start || !end || end <= start) {
      setError("The end time must be after the start time.");
      return;
    }

    setSaving(true);

    const { error: insertError } =
      await supabase
        .from("class_meetings")
        .insert({
          group_id: groupId,
          day_of_week: Number(day),
          starts_at: start,
          ends_at: end,
          room: room.trim() || null,
          kind,
        });

    setSaving(false);

    if (insertError) {
      setError(
        /class_meetings|schema cache/i.test(insertError.message)
          ? "Class times aren't set up yet. Run supabase/14-real-classroom.sql in Supabase."
          : insertError.message
      );
      return;
    }

    onDone();
  }

  return (
    <form className="course-post-form course-meeting-form" onSubmit={save}>
      {error && <p className="course-error" role="alert">{error}</p>}
      <div className="course-field-row wrap">
        <label className="course-field">
          <span>Day</span>
          <select value={day} onChange={(event) => setDay(event.target.value)}>
            {DAY_NAMES.slice(1).map((name, index) => (
              <option key={name} value={index + 1}>{name}</option>
            ))}
          </select>
        </label>
        <label className="course-field">
          <span>Starts</span>
          <input type="time" value={start} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label className="course-field">
          <span>Ends</span>
          <input type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
        </label>
      </div>
      <div className="course-field-row wrap">
        <label className="course-field">
          <span>Type</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option>Lecture</option>
            <option>Tutorial</option>
            <option>Lab</option>
            <option>Other</option>
          </select>
        </label>
        <label className="course-field">
          <span>Room <em>(optional)</em></span>
          <input value={room} maxLength={100} onChange={(event) => setRoom(event.target.value)} placeholder="e.g. DK1, Block A" />
        </label>
      </div>
      <div className="course-actions">
        <button type="submit" className="course-button primary small" disabled={saving}>
          {saving ? "Saving..." : "Add class time"}
        </button>
        <button type="button" className="course-button small" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}


function CourseTimetable({ groupId, meetings, isTeacher, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const sorted =
    [...meetings].sort((a, b) => a.day_of_week - b.day_of_week || String(a.starts_at).localeCompare(String(b.starts_at)));

  async function remove(meeting) {
    if (!window.confirm(`Remove ${meeting.kind} on ${DAY_NAMES[meeting.day_of_week]}?`)) return;

    const { error: deleteError } =
      await supabase.from("class_meetings").delete().eq("id", meeting.id);

    if (deleteError) setError(deleteError.message);
    else onChanged();
  }

  return (
    <div className="course-timetable">
      <div className="course-timetable-head">
        <h3>
          <Clock size={16} aria-hidden="true" />
          Class times
        </h3>
        {isTeacher && !adding && (
          <button type="button" className="course-button small" onClick={() => setAdding(true)}>
            <Plus size={14} aria-hidden="true" />
            Add
          </button>
        )}
      </div>

      {adding && (
        <AddMeeting
          groupId={groupId}
          onCancel={() => setAdding(false)}
          onDone={() => { setAdding(false); onChanged(); }}
        />
      )}

      {error && <p className="course-error" role="alert">{error}</p>}

      {sorted.length === 0 ? (
        <p className="course-muted">
          {isTeacher ? "Add the weekly lecture, tutorial and lab times so they show in students' Schedule." : "No class times added yet."}
        </p>
      ) : (
        <ul className="course-meetings">
          {sorted.map((meeting) => (
            <li key={meeting.id}>
              <span className="course-meeting-day">{DAY_NAMES[meeting.day_of_week].slice(0, 3)}</span>
              <span className="course-meeting-text">
                <strong>{formatClock(meeting.starts_at)} – {formatClock(meeting.ends_at)}</strong>
                <small>
                  {meeting.kind}
                  {meeting.room && <> · <MapPin size={12} aria-hidden="true" /> {meeting.room}</>}
                </small>
              </span>
              {isTeacher && (
                <button type="button" className="course-icon-button" onClick={() => remove(meeting)} aria-label="Remove class time">
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CourseTimetable;
