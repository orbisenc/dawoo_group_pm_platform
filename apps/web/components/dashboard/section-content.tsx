import {
  ApprovalWorkspace,
  CalendarWorkspace,
  DriveWorkspace,
} from "./functional-workspaces";
import { IssuesWorkspace } from "./issues-workspace";
import { ProjectsWorkspace } from "./projects-workspace";
import { AdminWorkspace } from "./admin-workspace";
import { BimWorkspace, CadWorkspace } from "./cad-workspace";
import { DrawingStatusWorkspace, ModelStatusWorkspace } from "./asset-status-workspaces";

function ProjectsScreen() {
  return <ProjectsWorkspace />;
}

function IssuesScreen() {
  return <IssuesWorkspace />;
}

function DriveScreen() {
  return <DriveWorkspace />;
}

function CalendarScreen() {
  return <CalendarWorkspace />;
}

function ViewerScreen() {
  return <BimWorkspace />;
}

function ApprovalsScreen() {
  return <ApprovalWorkspace />;
}

function CadScreen() {
  return <CadWorkspace />;
}

function ModelStatusScreen() {
  return <ModelStatusWorkspace />;
}

function DrawingStatusScreen() {
  return <DrawingStatusWorkspace />;
}

export function SectionContent({ slug }: { slug: string }) {
  if (slug === "projects") return <ProjectsScreen />;
  if (slug === "issues") return <IssuesScreen />;
  if (slug === "drive") return <DriveScreen />;
  if (slug === "calendar") return <CalendarScreen />;
  if (slug === "viewer") return <ViewerScreen />;
  if (slug === "cad") return <CadScreen />;
  if (slug === "model-status") return <ModelStatusScreen />;
  if (slug === "drawing-status") return <DrawingStatusScreen />;
  if (slug === "approvals") return <ApprovalsScreen />;
  if (slug === "admin") return <AdminWorkspace />;
  return null;
}
