import { Link } from "react-router-dom";

import { Search } from "lucide-react";

import "./SearchButton.css";


// Round search button that sits next to the notification bell.
function SearchButton() {
  return (
    <Link to="/search" className="search-button" aria-label="Search your classes" title="Search">
      <Search size={19} aria-hidden="true" />
    </Link>
  );
}

export default SearchButton;
