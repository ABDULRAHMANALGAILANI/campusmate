// =========================================================
// CAMPUSMATE PASSWORD RULES
//
// Used by the Register and Reset Password pages so both
// always ask for the same thing.
//
// Symbols such as @ _ . * ! # are allowed but not required.
// To change a rule, edit this list only.
// =========================================================

export const PASSWORD_RULES = [
  {
    id: "length",
    label: "At least 7 characters",
    test: (password) => password.length >= 7,
  },
  {
    id: "letter",
    label: "At least one letter",
    test: (password) => /\p{L}/u.test(password),
  },
  {
    id: "number",
    label: "At least one number",
    test: (password) => /[0-9]/.test(password),
  },
];


// Returns a message for the first rule the password breaks,
// or "" when the password is fine.
export function getPasswordProblem(password) {
  const broken =
    PASSWORD_RULES.find(
      (rule) => !rule.test(password)
    );

  return broken
    ? `Your password needs: ${broken.label.toLowerCase()}.`
    : "";
}
