type TabId = "general" | "assembly" | "setup" | "post-processor";

interface DialogTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "assembly", label: "Assembly" },
  { id: "setup", label: "Setup" },
  { id: "post-processor", label: "Post processor" },
];

export function DialogTabs({ activeTab, onTabChange }: DialogTabsProps) {
  return (
    <div
      role="tablist"
      className="flex h-8 shrink-0 items-stretch border-b border-weave-divider bg-weave-tab-bar px-1"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={[
              "relative mx-px flex items-center px-3 text-xs",
              isActive
                ? "bg-weave-tab-active font-bold text-weave-text-active"
                : "font-normal text-weave-text-placeholder hover:text-weave-text",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
