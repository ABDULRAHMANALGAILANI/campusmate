import {
  lazy,
  useEffect,
  useState,
} from "react";

const Projects =
  lazy(() => import("../pages/Projects"));

const ProfessorProjects =
  lazy(() => import("../pages/Professor/ProfessorProjects"));

import {
  supabase,
} from "../lib/supabase";


function ProjectsGate() {
  const [
    role,
    setRole,
  ] = useState(null);


  const [
    loading,
    setLoading,
  ] = useState(true);


  useEffect(() => {
    checkRole();
  }, []);


  async function checkRole() {
    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();


    if (!user) {
      setLoading(false);
      return;
    }


    const {
      data,
    } =
      await supabase
        .from("profiles")
        .select("role")
        .eq(
          "id",
          user.id
        )
        .maybeSingle();


    setRole(
      data?.role ||
      "student"
    );


    setLoading(false);
  }


  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Loading projects...
      </div>
    );
  }


  if (
    role ===
    "professor"
  ) {
    return (
      <ProfessorProjects />
    );
  }


  return (
    <Projects />
  );
}


export default ProjectsGate;