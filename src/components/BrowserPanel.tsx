import { useCallback, useState } from "react";
import type { DemoBlockBrowserNode } from "../data/demoBlockDesign";
import { DEMO_BLOCK_BROWSER_ROOT } from "../data/demoBlockDesign";
import "./panels.css";

/** Click row → fold/unfold subtree (Fusion CAM setups / ops groups). */
const COLLAPSIBLE_BROWSER_IDS = new Set(["cam-setups", "cam-op10", "cam-op20"]);

export type BrowserSelectMeta = {
  featureRowId?: string | undefined;
};

type BrowserPanelProps = {
  root?: DemoBlockBrowserNode;
  selectedId: string;
  onSelect: (nodeId: string, meta?: BrowserSelectMeta) => void;
};

export function BrowserPanel({
  root = DEMO_BLOCK_BROWSER_ROOT,
  selectedId,
  onSelect,
}: BrowserPanelProps) {
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  const toggleInteractiveFolder = useCallback((node: DemoBlockBrowserNode) => {
    if (!COLLAPSIBLE_BROWSER_IDS.has(node.id) || !(node.children && node.children.length > 0)) {
      return;
    }
    setExpandedById((prev) => {
      const cur = prev[node.id] ?? node.defaultExpanded === true;
      return { ...prev, [node.id]: !cur };
    });
  }, []);

  return (
    <section className="panel" aria-label="Browser">
      <div className="panel__header">Browser</div>
      <div className="panel__body">
        <ul className="browser-tree" role="tree" aria-label="Model browser">
          <BrowserBranch
            node={root}
            selectedId={selectedId}
            onSelect={onSelect}
            expandedById={expandedById}
            onToggleInteractiveFolder={toggleInteractiveFolder}
          />
        </ul>
      </div>
    </section>
  );
}

type BranchProps = {
  node: DemoBlockBrowserNode;
  selectedId: string;
  onSelect: (nodeId: string, meta?: BrowserSelectMeta) => void;
  expandedById: Record<string, boolean>;
  onToggleInteractiveFolder: (node: DemoBlockBrowserNode) => void;
};

function BrowserBranch({
  node,
  selectedId,
  onSelect,
  expandedById,
  onToggleInteractiveFolder,
}: BranchProps) {
  const selectable = node.selectable !== false;
  const hasChildren = node.children !== undefined && node.children.length > 0;
  const interactiveFolder = COLLAPSIBLE_BROWSER_IDS.has(node.id) && hasChildren === true;

  const subtreeMounted =
    interactiveFolder !== true ||
    (expandedById[node.id] ?? node.defaultExpanded === true);

  const expandedChevron: boolean | undefined =
    hasChildren !== true
      ? undefined
      : interactiveFolder === true
        ? subtreeMounted === true
        : node.defaultExpanded === true;

  const handleActivate = (): void => {
    if (interactiveFolder === true) {
      onToggleInteractiveFolder(node);
      return;
    }
    if (selectable === true) {
      const meta =
        node.linkedFeatureRowId !== undefined
          ? ({ featureRowId: node.linkedFeatureRowId } satisfies BrowserSelectMeta)
          : undefined;
      onSelect(node.id, meta);
    }
  };

  const activateable = interactiveFolder === true || selectable === true;

  return (
    <li>
      <TreeRow
        label={node.label}
        expanded={expandedChevron}
        focusable={activateable === true}
        selected={selectable && selectedId === node.id}
        onActivate={activateable === true ? handleActivate : undefined}
      />
      {hasChildren === true && subtreeMounted === true ? (
        <ul role="group">
          {node.children?.map((child) => (
            <BrowserBranch
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedById={expandedById}
              onToggleInteractiveFolder={onToggleInteractiveFolder}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

type TreeRowProps = {
  label: string;
  expanded?: boolean | undefined;
  focusable?: boolean;
  selected?: boolean;
  onActivate?: () => void;
};

function TreeRow({
  label,
  expanded,
  focusable = true,
  selected,
  onActivate,
}: TreeRowProps) {
  const className = ["browser-tree__row", selected ? "browser-tree__row--selected" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      role={onActivate !== undefined ? "treeitem" : "presentation"}
      tabIndex={focusable === true && onActivate !== undefined ? 0 : -1}
      onClick={() => {
        if (onActivate !== undefined) {
          onActivate();
        }
      }}
      onKeyDown={(e) => {
        if (onActivate === undefined) {
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      <span className="browser-tree__chevron" aria-hidden>
        {expanded === undefined ? "" : expanded === true ? "▼" : "▶"}
      </span>
      <span className="browser-tree__label">{label}</span>
    </div>
  );
}
