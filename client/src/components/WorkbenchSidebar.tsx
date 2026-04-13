import type { InputRequest } from "../api/types";
import { ChatWidget } from "./ChatWidget";
import { DailySummaryBar } from "./DailySummaryBar";
import { InputNotificationBanner } from "./InputNotificationBanner";
import { NotificationPrompt } from "./NotificationPrompt";

interface WorkbenchSidebarProps {
  requests: InputRequest[];
}

export function WorkbenchSidebar({ requests }: WorkbenchSidebarProps) {
  return (
    <aside className="workbench-rail">
      <div className="workbench-rail__stack">
        <InputNotificationBanner requests={requests} embedded />
        <NotificationPrompt embedded />
        <ChatWidget embedded />
        <DailySummaryBar embedded />
      </div>
    </aside>
  );
}
