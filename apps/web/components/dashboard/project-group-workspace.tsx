"use client";

import { useState } from "react";

import { DatabaseIssueFeed } from "./database-issue-feed";
import { useProject } from "./project-context";

const groups = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    name: "설계 관리",
    icon: "▱",
    description: "설계 검토·도면 협의",
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    name: "시공 관리",
    icon: "▤",
    description: "공정·품질·현장 이슈",
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    name: "기획 관리",
    icon: "◇",
    description: "사업 기획·의사결정",
  },
  {
    id: "40000000-0000-4000-8000-000000000004",
    name: "공지 사항",
    icon: "◉",
    description: "프로젝트 전체 공지",
  },
] as const;

export function ProjectGroupWorkspace() {
  const { selectedProject } = useProject();
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0].id);
  const selectedGroup =
    groups.find((group) => group.id === selectedGroupId) ?? groups[0];

  return (
    <div className="issue-route-layout">
      <aside className="project-rail group-rail">
        <div className="group-project-parent">
          <span>프로젝트</span>
          <strong>{selectedProject.name}</strong>
          <small>프로젝트 아래 협업 그룹</small>
        </div>
        <div className="rail-heading">
          <h2>그룹</h2>
          <button type="button" aria-label="그룹 추가">
            +
          </button>
        </div>
        <div className="project-rail-list group-rail-list">
          {groups.map((group) => (
            <button
              className={
                selectedGroupId === group.id
                  ? "rail-group active"
                  : "rail-group"
              }
              onClick={() => setSelectedGroupId(group.id)}
              type="button"
              key={group.id}
            >
              <i aria-hidden="true">{group.icon}</i>
              <span>
                <strong>{group.name}</strong>
                <small>{group.description}</small>
              </span>
            </button>
          ))}
        </div>
      </aside>
      <DatabaseIssueFeed
        projectId={selectedProject.id}
        groupId={selectedGroup.id}
        groupName={selectedGroup.name}
      />
    </div>
  );
}
