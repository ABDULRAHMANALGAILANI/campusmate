import {
  useEffect,
  useState,
} from "react";

import {
  Navigate,
  useLocation,
} from "react-router-dom";

import {
  supabase,
} from "../lib/supabase";

import PrivacyGate from "./PrivacyGate";


function ProtectedRoute({
  children,
  allowedRole = null,
}) {
  const location =
    useLocation();


  const [
    session,
    setSession,
  ] = useState(null);


  const [
    loading,
    setLoading,
  ] = useState(true);


  // =========================================================
  // CHECK SUPABASE SESSION
  // =========================================================

  useEffect(() => {
    let active =
      true;


    async function loadSession() {
      try {
        const {
          data,
          error,
        } =
          await supabase.auth.getSession();


        if (!active) {
          return;
        }


        if (error) {
          console.error(
            "ProtectedRoute session error:",
            error
          );
        }


        setSession(
          data?.session ||
          null
        );

      } catch (error) {
        console.error(
          "ProtectedRoute error:",
          error
        );


        if (active) {
          setSession(
            null
          );
        }

      } finally {
        if (active) {
          setLoading(
            false
          );
        }
      }
    }


    loadSession();


    // =======================================================
    // LISTEN FOR LOGIN / LOGOUT CHANGES
    // =======================================================

    const {
      data:
        authListener,
    } =
      supabase.auth.onAuthStateChange(
        (
          _event,
          newSession
        ) => {

          if (!active) {
            return;
          }


          setSession(
            newSession ||
            null
          );


          setLoading(
            false
          );
        }
      );


    // =======================================================
    // CLEANUP
    // =======================================================

    return () => {
      active =
        false;


      authListener?.subscription
        ?.unsubscribe();
    };
  }, []);


  // =========================================================
  // ROLE CHECK (only when a route requires a specific role)
  //
  // NOTE: this only controls which pages are shown.
  // Real data protection must come from Supabase RLS.
  // =========================================================

  const [
    userRole,
    setUserRole,
  ] = useState(null);

  const [
    roleLoading,
    setRoleLoading,
  ] = useState(Boolean(allowedRole));

  const userId =
    session?.user?.id || null;

  useEffect(() => {
    if (!allowedRole || !userId) {
      return;
    }

    let active =
      true;

    async function loadRole() {
      setRoleLoading(true);

      const {
        data,
        error,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (error) {
        console.error(
          "ProtectedRoute role error:",
          error
        );
      }

      // Anyone without a confirmed role is treated as a student.
      setUserRole(
        data?.role || "student"
      );

      setRoleLoading(false);
    }

    loadRole();

    return () => {
      active =
        false;
    };
  }, [allowedRole, userId]);


  // =========================================================
  // WAIT FOR SUPABASE
  // =========================================================

  if (
    loading ||
    (allowedRole && session?.user && (roleLoading || !userRole))
  ) {
    return (
      <div
        style={{
          width:
            "100%",

          minHeight:
            "100vh",

          display:
            "flex",

          flexDirection:
            "column",

          alignItems:
            "center",

          justifyContent:
            "center",

          gap:
            "10px",

          background:
            "#f5f8fc",

          color:
            "#2563eb",

          fontFamily:
            "Arial, sans-serif",
        }}
      >

        <div
          style={{
            width:
              "38px",

            height:
              "38px",

            border:
              "4px solid #dbeafe",

            borderTopColor:
              "#2563eb",

            borderRadius:
              "50%",

            animation:
              "spin 0.8s linear infinite",
          }}
        />


        <strong>
          Loading CampusMate...
        </strong>


        <style>
          {`
            @keyframes spin {
              from {
                transform: rotate(0deg);
              }

              to {
                transform: rotate(360deg);
              }
            }
          `}
        </style>

      </div>
    );
  }


  // =========================================================
  // NOT LOGGED IN
  // =========================================================

  if (!session?.user) {
    return (
      <Navigate
        to="/"
        replace
        state={{
          from:
            location.pathname,
        }}
      />
    );
  }


  // =========================================================
  // TEMPORARY PASSWORD
  // Accounts made by a school must choose their own password
  // before they can use anything else.
  // =========================================================

  if (
    session.user.app_metadata?.must_change_password &&
    location.pathname !== "/change-password"
  ) {
    return (
      <Navigate
        to="/change-password"
        replace
      />
    );
  }


  // =========================================================
  // WRONG ROLE
  // Send people to their own dashboard instead.
  // =========================================================

  if (
    allowedRole &&
    userRole !== allowedRole
  ) {
    return (
      <Navigate
        to={
          userRole === "professor"
            ? "/professor/dashboard"
            : userRole === "school_admin"
              ? "/school-admin"
              : "/dashboard"
        }
        replace
      />
    );
  }


  // =========================================================
  // LOGGED IN (after agreeing to the Privacy Notice)
  // =========================================================

  if (location.pathname === "/change-password") {
    return children;
  }

  return (
    <PrivacyGate user={session.user}>
      {children}
    </PrivacyGate>
  );
}


export default ProtectedRoute;