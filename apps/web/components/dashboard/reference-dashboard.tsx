"use client";

import { IssueFeed } from "./issue-feed";
import { ProjectRail } from "./project-rail";
import { ProjectOverview } from "./project-overview";
import { WorkspaceRight } from "./workspace-right";

export function ReferenceDashboard() {
  return (
    <div className="dawoo-dashboard">
      <ProjectOverview />
      <div className="reference-dashboard">
        <ProjectRail />
        <IssueFeed title="이슈 피드" />
        <WorkspaceRight />
      </div>
    </div>
  );
}
