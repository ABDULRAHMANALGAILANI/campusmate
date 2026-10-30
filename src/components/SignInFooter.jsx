import { Link } from "react-router-dom";

import LanguageSwitcher from "./LanguageSwitcher";


// Footer on the sign-in pages: help, privacy and language
function SignInFooter() {
  return (
    <footer className="signin-footer signin-footer-links">
      <span>© {new Date().getFullYear()} CampusMate</span>
      <Link to="/help">Help</Link>
      <Link to="/privacy">Privacy</Link>
      <LanguageSwitcher />
    </footer>
  );
}

export default SignInFooter;
