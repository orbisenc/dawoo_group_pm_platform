"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { dawooProjects } from "../../lib/dawoo-projects";

export type ProjectOption = {
  id: string;
  name: string;
  period: string;
  crop: string;
  image?: string;
  code?: string;
  category?: string;
  organization?: string;
  location?: string;
  description?: string;
  sourceUrl?: string;
  facts?: { label: string; value: string }[];
  workspaceReadiness?: number;
};

export type NewProjectInput = {
  name: string;
  category: string;
  location: string;
  description: string;
  image?: string;
};

const customProjectsStorageKey = "project-hub-custom-projects";
const projectOverridesStorageKey = "project-hub-project-overrides";

function getProjectStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export const projectOptions: ProjectOption[] = dawooProjects.map((project) => ({
  id: project.id,
  name: project.name,
  period: project.category,
  crop: "",
  image: project.image,
  code: project.code,
  category: project.category,
  organization: project.organization,
  location: project.location,
  description: project.description,
  sourceUrl: project.sourceUrl,
  facts: project.facts,
  workspaceReadiness: project.workspaceReadiness,
}));

type ProjectContextValue = {
  selectedProject: ProjectOption;
  projects: ProjectOption[];
  selectProject: (projectId: string) => void;
  addProject: (project: NewProjectInput) => ProjectOption;
  updateProject: (projectId: string, project: NewProjectInput) => void;
  removeProject: (projectId: string) => void;
  replaceProjects: (projects: ProjectOption[]) => void;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState(projectOptions);
  const [selectedId, setSelectedId] = useState(projectOptions[0]!.id);

  useEffect(() => {
    let active = true;
    const storage = getProjectStorage();
    if (!storage) return;
    try {
      const storedCustomProjects = storage.getItem(customProjectsStorageKey);
      const storedOverrides = storage.getItem(projectOverridesStorageKey);
      const customProjects = storedCustomProjects
        ? JSON.parse(storedCustomProjects) as ProjectOption[]
        : [];
      const projectOverrides = storedOverrides
        ? JSON.parse(storedOverrides) as ProjectOption[]
        : [];
      const validProjects = customProjects.filter(
        (project) =>
          typeof project.id === "string" &&
          typeof project.name === "string" &&
          typeof project.period === "string",
      );
      const validOverrides = projectOverrides.filter(
        (project) =>
          typeof project.id === "string" &&
          typeof project.name === "string" &&
          projectOptions.some((item) => item.id === project.id),
      );
      if (validProjects.length || validOverrides.length) {
        queueMicrotask(() => {
          if (!active) return;
          setProjects((current) => [
            ...current.map((project) =>
              validOverrides.find((override) => override.id === project.id) ?? project,
            ),
            ...validProjects.filter(
              (project) => !current.some((item) => item.id === project.id),
            ),
          ]);
        });
      }
    } catch {
      storage.removeItem(customProjectsStorageKey);
      storage.removeItem(projectOverridesStorageKey);
    }
    return () => {
      active = false;
    };
  }, []);

  const selectedProject =
    projects.find((project) => project.id === selectedId) ??
    projects[0] ??
    projectOptions[0]!;
  const addProject = useCallback((input: NewProjectInput) => {
    const project: ProjectOption = {
      id: `local-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
      name: input.name.trim(),
      period: input.category.trim() || "일반 프로젝트",
      crop: "",
      image: input.image,
      code: `DW-${Date.now().toString().slice(-6)}`,
      category: input.category.trim() || "일반 프로젝트",
      organization: "(주)다우그룹",
      location: input.location.trim() || "위치 미정",
      description: input.description.trim() || "새로 등록한 프로젝트입니다.",
      facts: [
        { label: "등록 구분", value: "사용자 추가" },
        { label: "협업 공간", value: "준비 중" },
      ],
      workspaceReadiness: 10,
    };

    setProjects((current) => {
      const nextProjects = [...current, project];
      const customProjects = nextProjects.filter((item) => item.id.startsWith("local-"));
      getProjectStorage()?.setItem(customProjectsStorageKey, JSON.stringify(customProjects));
      return nextProjects;
    });
    setSelectedId(project.id);
    return project;
  }, []);
  const updateProject = useCallback((projectId: string, input: NewProjectInput) => {
    setProjects((current) => {
      const nextProjects = current.map((project) => {
        if (project.id !== projectId) return project;
        const category = input.category.trim() || "일반 프로젝트";
        return {
          ...project,
          name: input.name.trim(),
          period: category,
          category,
          location: input.location.trim() || "위치 미정",
          description: input.description.trim() || "프로젝트 설명이 없습니다.",
          image: input.image,
        };
      });
      const storage = getProjectStorage();
      storage?.setItem(
        customProjectsStorageKey,
        JSON.stringify(nextProjects.filter((project) => project.id.startsWith("local-"))),
      );
      storage?.setItem(
        projectOverridesStorageKey,
        JSON.stringify(nextProjects.filter((project) => {
          if (project.id.startsWith("local-")) return false;
          const original = projectOptions.find((item) => item.id === project.id);
          return original ? JSON.stringify(original) !== JSON.stringify(project) : true;
        })),
      );
      return nextProjects;
    });
  }, []);
  const removeProject = useCallback((projectId: string) => {
    setProjects((current) => {
      if (current.length <= 1) return current;
      const nextProjects = current.filter((project) => project.id !== projectId);
      const customProjects = nextProjects.filter((item) => item.id.startsWith("local-"));
      getProjectStorage()?.setItem(customProjectsStorageKey, JSON.stringify(customProjects));
      return nextProjects;
    });
    setSelectedId((current) => current === projectId ? projectOptions[0]!.id : current);
  }, []);
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
        addProject,
        updateProject,
        removeProject,
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
