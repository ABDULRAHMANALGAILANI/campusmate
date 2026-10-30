// =========================================================
// CSV HELPERS (school admin upload / download)
// Handles quotes, commas inside quotes, and Excel's BOM.
// =========================================================

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const source =
    text.replace(/^\uFEFF/, "");

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop empty lines
  return rows.filter((cells) =>
    cells.some((cell) => cell.trim() !== "")
  );
}


// Accepts a few spellings for each column.
const HEADER_NAMES = {
  full_name: ["full_name", "full name", "name", "student name", "fullname"],
  email: ["email", "e-mail", "email address", "school email"],
  role: ["role", "type", "account type"],
  student_id: ["student_id", "student id", "student number", "matric", "matric no", "id number"],
  programme: ["programme", "program", "course", "department"],
};


// Turns CSV text into people + a list of problems per row.
export function readPeopleCsv(text) {
  const rows =
    parseCsv(text);

  if (rows.length < 2) {
    return {
      people: [],
      problem: "The file is empty. Use the template: one person per row under the headings.",
    };
  }

  const headers =
    rows[0].map((cell) => cell.trim().toLowerCase());

  const column = {};

  for (const [key, names] of Object.entries(HEADER_NAMES)) {
    column[key] =
      headers.findIndex((header) => names.includes(header));
  }

  if (column.full_name < 0 || column.email < 0) {
    return {
      people: [],
      problem: "The first row must have the headings full_name and email (download the template to see the layout).",
    };
  }

  const seen = new Set();

  const people =
    rows.slice(1).map((cells, index) => {
      const get = (key) =>
        column[key] >= 0 ? (cells[column[key]] || "").trim() : "";

      const person = {
        line: index + 2,
        full_name: get("full_name"),
        email: get("email").toLowerCase(),
        role: (get("role") || "student").toLowerCase(),
        student_id: get("student_id"),
        programme: get("programme"),
      };

      person.problem =
        checkPerson(person, seen);

      seen.add(person.email);

      return person;
    });

  return {
    people,
    problem: "",
  };
}


export function checkPerson(person, seenEmails = new Set()) {
  if (!person.full_name) return "Name is missing.";
  if (person.full_name.trim().split(/\s+/).length < 2) return "Use their full name (first and last name).";
  if (/[0-9]/.test(person.full_name)) return "Names can't contain numbers.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email)) return "Email isn't valid.";
  if (seenEmails.has(person.email)) return "This email is in the file twice.";
  if (!["student", "professor"].includes(person.role)) return "Role must be student or professor.";
  return "";
}


function csvCell(value) {
  const text =
    String(value ?? "");

  return /[",\n\r]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}


export function toCsv(rows) {
  return rows
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}


export function downloadCsv(filename, rows) {
  // BOM so Excel opens accents/Arabic names correctly
  const blob =
    new Blob(["\uFEFF" + toCsv(rows)], {
      type: "text/csv;charset=utf-8",
    });

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


export const TEMPLATE_ROWS = [
  ["full_name", "email", "role", "student_id", "programme"],
  ["Aisha Rahman", "aisha.rahman@yourschool.edu.my", "student", "S2026001", "Computer Science"],
  ["Daniel Lim", "daniel.lim@yourschool.edu.my", "student", "S2026002", "Business"],
  ["Dr Tan Wei Ming", "tan.weiming@yourschool.edu.my", "professor", "", "Computer Science"],
];
