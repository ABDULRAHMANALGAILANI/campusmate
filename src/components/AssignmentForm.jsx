import { useState } from "react";

import {
  Paperclip,
  Save,
  X,
} from "lucide-react";

import { supabase } from "../lib/supabase";

import {
  MATERIAL_LIMIT_MB,
  formatSize,
  removeFile,
  tooBig,
  uploadMaterial,
} from "../lib/courseFiles";

import "./AssignmentForm.css";


// =========================================================
// ASSIGNMENT FORM (create + edit)
// Used on the course page and on the professor Assignments page.
//   - attach a question sheet / template
//   - "students hand in" or "mark only" (exam, test, presentation)
//   - weight (% of the final grade)
//   - marks hidden until released (or shown straight away)
// =========================================================

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}


function classLabel(group) {
  return group.course_code ? `${group.course_code} — ${group.name}` : group.name;
}


function AssignmentForm({
  assignment = null,
  groups = [],
  fixedGroupId = "",
  userId,
  onSaved,
  onCancel,
}) {
  const editing =
    Boolean(assignment);

  const [groupId, setGroupId] = useState(assignment?.group_id || fixedGroupId || groups[0]?.id || "");
  const [title, setTitle] = useState(assignment?.title || "");
  const [description, setDescription] = useState(assignment?.description || "");
  const [dueDate, setDueDate] = useState(toLocalInput(assignment?.due_at));
  const [points, setPoints] = useState(assignment?.points ?? 100);
  const [weight, setWeight] = useState(
    assignment?.weight !== null && assignment?.weight !== undefined ? String(Number(assignment.weight)) : ""
  );
  const [handIn, setHandIn] = useState(assignment ? assignment.hand_in !== false : true);
  const [allowLate, setAllowLate] = useState(assignment ? assignment.allow_late !== false : true);
  const [showMarks, setShowMarks] = useState(false);
  const [file, setFile] = useState(null);
  const [removeOld, setRemoveOld] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");


  async function save(event) {
    event.preventDefault();
    setError("");

    if (!groupId) return setError("Choose a class.");
    if (!title.trim()) return setError("Give the assignment a title.");
    if (!dueDate) return setError(handIn ? "Choose the due date and time." : "Choose the date of the exam or test.");

    const parsedPoints = Number(points);
    if (Number.isNaN(parsedPoints) || parsedPoints <= 0) {
      return setError("Marks must be more than 0.");
    }

    const parsedWeight = weight.trim() === "" ? null : Number(weight);
    if (parsedWeight !== null && (Number.isNaN(parsedWeight) || parsedWeight < 0 || parsedWeight > 100)) {
      return setError("Weight must be between 0 and 100%.");
    }

    if (tooBig(file, MATERIAL_LIMIT_MB)) {
      return setError(`That file is too big. The limit is ${MATERIAL_LIMIT_MB} MB.`);
    }

    setSaving(true);

    let newPath = null;

    try {
      if (file) {
        newPath = await uploadMaterial(groupId, file);
      }

      const row = {
        title: title.trim(),
        description: description.trim() || null,
        due_at: new Date(dueDate).toISOString(),
        points: parsedPoints,
        weight: parsedWeight,
        hand_in: handIn,
        allow_late: handIn ? allowLate : true,
      };

      if (file) {
        row.file_path = newPath;
        row.file_name = file.name;
      } else if (removeOld) {
        row.file_path = null;
        row.file_name = null;
      }

      const result =
        editing
          ? await supabase
              .from("class_assignments")
              .update(row)
              .eq("id", assignment.id)
              .select()
              .single()
          : await supabase
              .from("class_assignments")
              .insert({
                ...row,
                group_id: groupId,
                professor_id: userId,
                marks_released: showMarks,
              })
              .select()
              .single();

      if (result.error) throw result.error;

      // Old brief replaced or removed
      if (editing && assignment.file_path && (file || removeOld)) {
        await removeFile("course-files", assignment.file_path);
      }

      onSaved?.(result.data);
    } catch (saveError) {
      if (newPath) await removeFile("course-files", newPath);

      const message =
        saveError.message || "Couldn't save the assignment.";

      setError(
        /hand_in|weight|file_path|marks_released|schema cache/i.test(message)
          ? "The database needs updating. Run supabase/14-real-classroom.sql in the Supabase SQL Editor."
          : message
      );
      setSaving(false);
    }
  }


  return (
    <form className="af-form" onSubmit={save}>
      {error && <p className="af-error" role="alert">{error}</p>}

      {!fixedGroupId && !editing && (
        <label className="af-field">
          <span>Class</span>
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)} required>
            <option value="">Choose a class</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{classLabel(group)}</option>
            ))}
          </select>
        </label>
      )}

      <div className="af-type" role="radiogroup" aria-label="Type">
        <label className={handIn ? "active" : ""}>
          <input type="radio" name="af-type" checked={handIn} onChange={() => setHandIn(true)} />
          <span>
            <strong>Students hand in work</strong>
            <small>Assignment, lab report, project file</small>
          </span>
        </label>
        <label className={!handIn ? "active" : ""}>
          <input type="radio" name="af-type" checked={!handIn} onChange={() => setHandIn(false)} />
          <span>
            <strong>Mark only</strong>
            <small>Exam, test or presentation. You enter the marks.</small>
          </span>
        </label>
      </div>

      <label className="af-field">
        <span>Title</span>
        <input
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={handIn ? "e.g. Lab 3: Linked lists" : "e.g. Midterm test"}
          required
        />
      </label>

      <label className="af-field">
        <span>Instructions <em>(optional)</em></span>
        <textarea
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What should students do? How will it be marked?"
        />
      </label>

      <div className="af-file">
        <span className="af-label">Question sheet or template <em>(optional)</em></span>

        {editing && assignment.file_path && !file && !removeOld ? (
          <div className="af-current-file">
            <Paperclip size={15} aria-hidden="true" />
            <span>{assignment.file_name}</span>
            <button type="button" onClick={() => setRemoveOld(true)} aria-label="Remove file">
              <X size={15} />
            </button>
          </div>
        ) : null}

        <label className="af-dropzone">
          <Paperclip size={17} aria-hidden="true" />
          <span>
            {file
              ? <><strong>{file.name}</strong> ({formatSize(file.size)})</>
              : editing && assignment.file_path && !removeOld
                ? "Choose a file to replace it"
                : <>Attach a file <small>(PDF, Word… up to {MATERIAL_LIMIT_MB} MB)</small></>}
          </span>
          <input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>
      </div>

      <div className="af-row">
        <label className="af-field">
          <span>{handIn ? "Due date and time" : "Date"}</span>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            required
          />
        </label>

        <label className="af-field small">
          <span>Out of (marks)</span>
          <input
            type="number"
            min="1"
            step="0.5"
            value={points}
            onChange={(event) => setPoints(event.target.value)}
          />
        </label>

        <label className="af-field small">
          <span>Weight <em>% of final</em></span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            placeholder="e.g. 20"
          />
        </label>
      </div>

      {handIn && (
        <label className="af-check">
          <input type="checkbox" checked={allowLate} onChange={(event) => setAllowLate(event.target.checked)} />
          <span>
            Accept late hand-ins
            <small>{allowLate ? "Late work is accepted and labelled \"late\"." : "Students can't hand in after the deadline."}</small>
          </span>
        </label>
      )}

      {!editing && (
        <label className="af-check">
          <input type="checkbox" checked={showMarks} onChange={(event) => setShowMarks(event.target.checked)} />
          <span>
            Show marks to students as soon as I save them
            <small>
              {showMarks
                ? "Each student sees their mark right away."
                : "Marks stay hidden until you click Release marks."}
            </small>
          </span>
        </label>
      )}

      {editing && (
        <p className="af-hint">Students in the class get a notification when you change the date or details.</p>
      )}

      <div className="af-actions">
        <button type="button" className="af-button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="af-button primary" disabled={saving}>
          <Save size={16} aria-hidden="true" />
          {saving ? "Saving..." : editing ? "Save changes" : "Post assignment"}
        </button>
      </div>
    </form>
  );
}

export default AssignmentForm;
