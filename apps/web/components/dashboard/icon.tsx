import type { IconName } from "../../lib/navigation";

const paths: Record<IconName, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  projects: <><path d="M3 7.5h18v11.2A2.3 2.3 0 0 1 18.7 21H5.3A2.3 2.3 0 0 1 3 18.7Z"/><path d="M3 7.5V6.3A2.3 2.3 0 0 1 5.3 4h4l2 2h7.4A2.3 2.3 0 0 1 21 8.3"/></>,
  issues: <><path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9.8 9.8 0 0 1-4-.9L3 21l1.7-4.3A8.2 8.2 0 0 1 3 11.5a8.5 8.5 0 0 1 9-8.5 8.5 8.5 0 0 1 9 8.5Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></>,
  drive: <><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h4l2 2h7A2.5 2.5 0 0 1 21 8.5v10a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5Z"/><path d="m9 15 3-3 3 3M12 12v6"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  viewer: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
  cad: <><path d="M4 3h16v18H4z"/><path d="M8 17 17 8M8 8h5v5M16 16h.01"/></>,
  approvals: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h4M8 16l2 2 5-5"/></>,
  admin: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0M18 4l1-1M5 4 4 3"/></>,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  );
}
