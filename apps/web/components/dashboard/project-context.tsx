"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

import { dawooProjects } from "../../lib/dawoo-projects";

export type ProjectOption = {
  id: string;
  name: string;
  period: string;
  crop: string;
  image?: string;
};

export const projectOptions: ProjectOption[] = dawooProjects.map((project) => ({
  id: project.id,
  name: project.name,
  period: `${project.category} · ${project.status}`,
  crop: "",
  image: project.image,
}));

type ProjectContextValue = {
  selectedProject: ProjectOption;
  projects: ProjectOption[];
  selectProject: (projectId: string) => void;
  replaceProjects: (projects: ProjectOption[]) => void;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState(projectOptions);
  const [selectedId, setSelectedId] = useState(projectOptions[0]!.id);
  const selectedProject =
    projects.find((project) => project.id === selectedId) ??
    projects[0] ??
    projectOptions[0]!;
  const replaceProjects = useCallback((nextProjects: ProjectOption[]) => {
    if (!nextProjects.length) return;
    setProjects(nextProjects);
    setSelectedId((current) =>
      nextProjects.some((project) => project.id === current)
        ? current
        : nextProjects[0]!.id,
    );
  }, []);
  return (
    <ProjectContext.Provider
      value={{
        selectedProject,
        projects,
        selectProject: setSelectedId,
        replaceProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const value = useContext(ProjectContext);
  if (!value)
    throw new Error("ProjectProvider 안에서 useProject를 사용해야 합니다.");
  return value;
}
