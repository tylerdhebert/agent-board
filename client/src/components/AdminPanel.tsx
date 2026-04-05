import { useState, useCallback } from "react";
import { useBoardStore } from "../store";
import { useEscapeToClose } from "../hooks/useEscapeStack";
import { ModalOverlay } from "./ui/ModalOverlay";
import { CardsSection } from "./admin/CardsSection";
import { MoveSection } from "./admin/MoveSection";
import { StatusesSection } from "./admin/StatusesSection";
import { EpicsSection } from "./admin/EpicsSection";
import { FeaturesSection } from "./admin/FeaturesSection";
import { RulesSection } from "./admin/RulesSection";
import { DangerSection } from "./admin/DangerSection";
import { ShortcutsSection } from "./admin/ShortcutsSection";
import { ReposSection } from "./admin/ReposSection";
import { WorkflowsSection } from "./admin/WorkflowsSection";

type Section =
  | "cards"
  | "move"
  | "statuses"
  | "epics"
  | "features"
  | "rules"
  | "shortcuts"
  | "repos"
  | "workflows"
  | "danger";

export function AdminPanel() {
  const setAdminPanelOpen = useBoardStore((s) => s.setAdminPanelOpen);
  const [activeSection, setActiveSection] = useState<Section>("cards");

  useEscapeToClose(useCallback(() => setAdminPanelOpen(false), [setAdminPanelOpen]));

  const sections: Section[] = [
    "statuses",
    "workflows",
    "repos",
    "epics",
    "features",
    "cards",
    "move",
    "rules",
    "shortcuts",
  ];

  return (
    <ModalOverlay onClose={() => setAdminPanelOpen(false)} className="flex flex-col h-[78vh] max-w-[1100px]">
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 py-4 shrink-0">
        <div>
          <div className="section-kicker mb-2">
            <span className="section-kicker__dot" />
            Control Room
          </div>
          <h2 className="display-title text-3xl leading-none">Admin Panel</h2>
        </div>
        <button
          onClick={() => setAdminPanelOpen(false)}
          className="chrome-button !px-3 !py-2 !text-[0.68rem]"
        >
          Close
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        <nav className="w-52 shrink-0 border-r border-[var(--border-soft)] bg-[var(--panel-soft)] p-3 overflow-y-auto">
          <div className="space-y-1">
            {sections.map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`w-full rounded-[18px] px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.2em] transition-all ${
                  activeSection === section
                    ? "border border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--text-primary)]"
                    : "border border-transparent text-[var(--text-muted)] hover:border-[var(--border-soft)] hover:bg-[var(--panel)] hover:text-[var(--text-primary)]"
                }`}
              >
                {section}
              </button>
            ))}
          </div>

          <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
            <button
              onClick={() => setActiveSection("danger")}
              className={`w-full rounded-[18px] px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.2em] transition-all ${
                activeSection === "danger"
                  ? "border border-red-400/40 bg-red-500/10 text-red-200"
                  : "border border-transparent text-[var(--text-muted)] hover:border-red-400/30 hover:bg-red-500/8 hover:text-red-200"
              }`}
            >
              danger
            </button>
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto p-5 min-w-0 bg-[var(--panel)]">
          {activeSection === "cards" && <CardsSection />}
          {activeSection === "move" && <MoveSection />}
          {activeSection === "statuses" && <StatusesSection />}
          {activeSection === "epics" && <EpicsSection />}
          {activeSection === "features" && <FeaturesSection />}
          {activeSection === "rules" && <RulesSection />}
          {activeSection === "shortcuts" && <ShortcutsSection />}
          {activeSection === "repos" && <ReposSection />}
          {activeSection === "workflows" && <WorkflowsSection />}
          {activeSection === "danger" && <DangerSection />}
        </div>
      </div>
    </ModalOverlay>
  );
}
