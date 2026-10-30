import { Languages } from "lucide-react";

import LanguageSwitcher from "./LanguageSwitcher";

import "./BiometricSettings.css";


// Settings card: choose the language for CampusMate on this device
function LanguageCard() {
  return (
    <section className="biometric-card">
      <div className="biometric-header">
        <div className="biometric-icon">
          <Languages size={22} aria-hidden="true" />
        </div>
        <div>
          <h2>Language</h2>
          <p>Choose the language CampusMate uses on this device.</p>
        </div>
      </div>
      <div className="biometric-body">
        <LanguageSwitcher variant="card" />
      </div>
    </section>
  );
}

export default LanguageCard;
