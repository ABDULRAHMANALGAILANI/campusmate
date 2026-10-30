import { Languages } from "lucide-react";

import {
  LANGUAGES,
  useLanguage,
} from "../lib/i18n";

import "./LanguageSwitcher.css";


// Language picker. Each language is shown in its own
// script, so anyone can find theirs.
function LanguageSwitcher({ variant = "plain" }) {
  const [language, setLanguage] = useLanguage();

  return (
    <label className={`lang-switch ${variant}`}>
      <Languages size={16} aria-hidden="true" />
      <span className="lang-switch-label">Language</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        aria-label="Language"
        data-no-translate
      >
        {LANGUAGES.map((item) => (
          <option key={item.code} value={item.code} lang={item.code}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default LanguageSwitcher;
