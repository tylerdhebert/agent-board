import { useState } from "react";
import { useBoardStore } from "../store";
import { CardsSection } from "./admin/CardsSection";
import { MoveSection } from "./admin/MoveSection";
import { StatusesSection } from "./admin/StatusesSection";
import { EpicsSection } from "./admin/EpicsSection";
import { FeaturesSection } from "./admin/FeaturesSection";
import { RulesSection } from "./admin/RulesSection";
import { DangerSection } from "./admin/DangerSection";
import { ShortcutsSection } from "./admin/ShortcutsSection";

type Section = "cards" | "move" | "statuses" | "epics" | "features" | "rules" | "shortcuts" | "danger";

export function AdminPanel() {
  const setAdminPanelOpen = useBoardStore((s) => s.setAdminPanelOpen);
  const [activeSection, setActiveSection] = useState<Section>("cards");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setAdminPanelOpen(false)}
    >
      <div
        className="relative w-full mx-4 bg-[#111118] border border-[#2a2a38] rounded-sm shadow-2xl flex flex-col h-[50vh]"
        style={{ maxWidth: 820 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2a] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[#6366f1]">⚙</span>
            <span className="text-sm font-mono font-semibold text-[#e2e8f0]">Admin Panel</span>
          </div>
          <button
            onClick={() => setAdminPanelOpen(false)}
            className="text-[#475569] hover:text-[#94a3b8] font-mono text-lg leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Body: sidenav + content */}
        <div className="flex flex-1 min-h-0">
          {/* Sidenav */}
          <nav className="w-36 shrink-0 border-r border-[#1e1e2a] flex flex-col py-2 overflow-y-auto">
            <div className="flex-1 flex flex-col">
              {(["cards", "move", "statuses", "epics", "features", "rules", "shortcuts"] as Section[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveSection(s)}
                  className={`text-left px-4 py-2 text-[13px] font-mono uppercase tracking-wider transition-colors ${
                    activeSection === s
                      ? "text-[#818cf8] bg-[#1e1e2a] border-l-2 border-[#6366f1]"
                      : "text-[#475569] hover:text-[#94a3b8] hover:bg-[#16161f] border-l-2 border-transparent"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="border-t border-[#1e1e2a] pt-2">
              <button
                onClick={() => setActiveSection("danger")}
                className={`w-full text-left px-4 py-2 text-[13px] font-mono uppercase tracking-wider transition-colors ${
                  activeSection === "danger"
                    ? "text-[#f87171] bg-[#1e1e2a] border-l-2 border-[#f87171]"
                    : "text-[#475569] hover:text-[#f87171] hover:bg-[#16161f] border-l-2 border-transparent"
                }`}
              >
                danger
              </button>
            </div>
          </nav>

          {/* Section body */}
          <div className="flex-1 overflow-y-auto p-4 min-w-0">
            {activeSection === "cards" && <CardsSection />}
            {activeSection === "move" && <MoveSection />}
            {activeSection === "statuses" && <StatusesSection />}
            {activeSection === "epics" && <EpicsSection />}
            {activeSection === "features" && <FeaturesSection />}
            {activeSection === "rules" && <RulesSection />}
            {activeSection === "shortcuts" && <ShortcutsSection />}
            {activeSection === "danger" && <DangerSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
