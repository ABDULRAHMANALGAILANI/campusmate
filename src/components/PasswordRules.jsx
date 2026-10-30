import {
  Check,
  Circle,
} from "lucide-react";

import {
  PASSWORD_RULES,
} from "../lib/passwordRules";

import "./PasswordRules.css";


// Live checklist shown under a "new password" field.
// Each rule turns green as soon as it is met.
function PasswordRules({
  password = "",
}) {
  return (
    <div className="password-rules">
      <ul aria-label="Password requirements">
        {PASSWORD_RULES.map((rule) => {
          const met =
            rule.test(password);

          return (
            <li
              key={rule.id}
              className={met ? "met" : ""}
            >
              {met ? (
                <Check
                  size={14}
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  size={14}
                  aria-hidden="true"
                />
              )}

              <span>
                {rule.label}
                <span className="password-rules-sr">
                  {met ? " (done)" : " (not yet)"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p>
        Symbols like @ _ . * are allowed.
      </p>
    </div>
  );
}

export default PasswordRules;
