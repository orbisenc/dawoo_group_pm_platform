"use client";

import { IssueFeed } from "./issue-feed";
import { ProjectRail } from "./project-rail";

export function IssuesWorkspace() {
  return (
    <div className="reference-dashboard issue-page-workspace">
      <ProjectRail />
      <IssueFeed title="이슈 피드" />
    </div>
  );
}
