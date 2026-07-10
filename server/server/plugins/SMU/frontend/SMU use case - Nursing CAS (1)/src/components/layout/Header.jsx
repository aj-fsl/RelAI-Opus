import React from "react";
import { NavLink } from "react-router-dom";
import logo from "../../assets/RelAI_logo.png";   // ✅ ADD THIS

const Header = () => {
  return (
    <header className="main-header">
      <div className="header-container">

        {/* Brand Section */}
        <div className="brand">
          {/* ✅ LOGO IMAGE */}
          <img
            src={logo}
            alt="Nursing CAS Logo"
            className="brand-logo"
          />

          <div className="brand-text">
            <h1>Nursing CAS</h1>
            <span className="brand-tagline">
              Intelligent Application Processing
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="main-nav">
          <NavLink to="/" className="nav-link">
            Dashboard
          </NavLink>

          <NavLink to="/upload" className="nav-link">
            Application Management
          </NavLink>
        </nav>

      </div>
    </header>
  );
};

export default Header;
