import { useCallback, useState } from "react";
import type { DemoBlockBrowserNode } from "../data/demoBlockDesign";
import { DEMO_BLOCK_BROWSER_ROOT } from "../data/demoBlockDesign";
import { BrowserIcon, browserIconUrl } from "./browserIcons";
import "./panels.css";

export type BrowserSelectMeta = {
  featureRowId?: string | undefined;
};

type BrowserPanelProps = {
  root?: DemoBlockBrowserNode;
  selectedId: string;
  onSelect: (nodeId: string, meta?: BrowserSelectMeta) => void;
  /** Right-click on a row, so the host can raise a context menu for it. */
  onContextMenuNode?: (nodeId: string, x: number, y: number) => void;
  /** Double-click / activate a row, e.g. to open the turret setup dialog. */
  onActivateNode?: (nodeId: string) => void;
  /** A row's show/hide was toggled; hidden is its new state. */
  onVisibilityChange?: (nodeId: string, hidden: boolean) => void;
};

export function BrowserPanel({
  root = DEMO_BLOCK_BROWSER_ROOT,
  selectedId,
  onSelect,
  onContextMenuNode,
  onActivateNode,
  onVisibilityChange,
}: BrowserPanelProps) {
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [hiddenById, setHiddenById] = useState<Record<string, boolean>>({});

  const toggleExpanded = useCallback((nodeId: string, fallback: boolean) => {
    setExpandedById((prev) => ({ ...prev, [nodeId]: !(prev[nodeId] ?? fallback) }));
  }, []);

  const toggleVisibility = useCallback(
    (nodeId: string) => {
      setHiddenById((prev) => {
        const hidden = prev[nodeId] !== true;
        onVisibilityChange?.(nodeId, hidden);
        return { ...prev, [nodeId]: hidden };
      });
    },
    [onVisibilityChange],
  );

  return (
    <section className="browser-hud" aria-label="Browser">
      <div className="browser-hud__title">Browser</div>
      <div className="browser-hud__body">
        <ul className="browser-tree" role="tree" aria-label="Model browser">
          <BrowserBranch
            node={root}
            depth={0}
            selectedId={selectedId}
            onSelect={onSelect}
            expandedById={expandedById}
            hiddenById={hiddenById}
            onToggleExpanded={toggleExpanded}
            onToggleVisibility={toggleVisibility}
            onContextMenuNode={onContextMenuNode}
            onActivateNode={onActivateNode}
          />
        </ul>
      </div>
    </section>
  );
}

type BranchProps = {
  node: DemoBlockBrowserNode;
  depth: number;
  selectedId: string;
  onSelect: (nodeId: string, meta?: BrowserSelectMeta) => void;
  expandedById: Record<string, boolean>;
  hiddenById: Record<string, boolean>;
  onToggleExpanded: (nodeId: string, fallback: boolean) => void;
  onToggleVisibility: (nodeId: string) => void;
  onContextMenuNode?: (nodeId: string, x: number, y: number) => void;
  onActivateNode?: (nodeId: string) => void;
};

function BrowserBranch({
  node,
  depth,
  selectedId,
  onSelect,
  expandedById,
  hiddenById,
  onToggleExpanded,
  onToggleVisibility,
  onContextMenuNode,
  onActivateNode,
}: BranchProps) {
  const selectable = node.selectable !== false;
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const defaultExpanded = node.defaultExpanded === true;
  const expanded = hasChildren && (expandedById[node.id] ?? defaultExpanded);

  const handleActivate = (): void => {
    if (selectable) {
      const meta =
        node.linkedFeatureRowId !== undefined
          ? ({ featureRowId: node.linkedFeatureRowId } satisfies BrowserSelectMeta)
          : undefined;
      onSelect(node.id, meta);
      return;
    }
    if (hasChildren) {
      onToggleExpanded(node.id, defaultExpanded);
    }
  };

  return (
    <li>
      <TreeRow
        node={node}
        depth={depth}
        expandable={hasChildren}
        expanded={expanded}
        selected={selectable && selectedId === node.id}
        hidden={hiddenById[node.id] === true}
        onActivate={handleActivate}
        onToggleExpanded={() => {
          onToggleExpanded(node.id, defaultExpanded);
        }}
        onToggleVisibility={() => {
          onToggleVisibility(node.id);
        }}
        onContextMenu={
          onContextMenuNode !== undefined
            ? (x, y) => {
                onContextMenuNode(node.id, x, y);
              }
            : undefined
        }
        onDoubleActivate={
          onActivateNode !== undefined
            ? () => {
                onActivateNode(node.id);
              }
            : undefined
        }
      />
      {expanded ? (
        <ul role="group">
          {children.map((child) => (
            <BrowserBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedById={expandedById}
              hiddenById={hiddenById}
              onToggleExpanded={onToggleExpanded}
              onToggleVisibility={onToggleVisibility}
              onContextMenuNode={onContextMenuNode}
              onActivateNode={onActivateNode}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

type TreeRowProps = {
  node: DemoBlockBrowserNode;
  depth: number;
  expandable: boolean;
  expanded: boolean;
  selected: boolean;
  hidden: boolean;
  onActivate: () => void;
  onToggleExpanded: () => void;
  onToggleVisibility: () => void;
  onContextMenu?: (x: number, y: number) => void;
  onDoubleActivate?: () => void;
};

/**
 * One row, laid out as Fusion lays it out: an expand arrow that paints nothing,
 * then a chip holding the show/hide control, the node icon and the label. Only
 * the chip has a background, and only as wide as its contents, so the canvas
 * shows through everywhere else. Metrics come from the product's browser style:
 * 24px rows, 11px of indent to start, 18px per level, 25px more where there is
 * no expander to leave room for.
 */
function TreeRow({
  node,
  depth,
  expandable,
  expanded,
  selected,
  hidden,
  onActivate,
  onToggleExpanded,
  onToggleVisibility,
  onContextMenu,
  onDoubleActivate,
}: TreeRowProps) {
  const chevron = browserIconUrl(expanded ? "collapse" : "expand");
  const eye = browserIconUrl(hidden ? "hidden" : "visible");
  const showsVisibility = node.noVisibility !== true;

  return (
    <div
      className={[
        "browser-tree__row",
        selected ? "browser-tree__row--selected" : "",
        hidden ? "browser-tree__row--hidden" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="treeitem"
      aria-expanded={expandable ? expanded : undefined}
      aria-selected={selected}
      tabIndex={0}
      style={{ paddingLeft: 11 + depth * 18 + (expandable ? 0 : 25) }}
      onClick={onActivate}
      onDoubleClick={onDoubleActivate}
      onContextMenu={
        onContextMenu !== undefined
          ? (e) => {
              e.preventDefault();
              onContextMenu(e.clientX, e.clientY);
            }
          : undefined
      }
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      {expandable ? (
        <button
          type="button"
          className="browser-tree__chevron"
          aria-label={expanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpanded();
          }}
        >
          {chevron === undefined ? (
            <span aria-hidden>{expanded ? "▾" : "▸"}</span>
          ) : (
            <img src={chevron} alt="" width={16} height={16} draggable={false} />
          )}
        </button>
      ) : null}

      <span className="browser-tree__chip">
        {showsVisibility && eye !== undefined ? (
          <button
            type="button"
            className="browser-tree__eye"
            aria-label={hidden ? `Show ${node.label}` : `Hide ${node.label}`}
            aria-pressed={hidden}
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility();
            }}
          >
            <img src={eye} alt="" width={16} height={16} draggable={false} />
          </button>
        ) : (
          <span className="browser-tree__eye browser-tree__eye--empty" aria-hidden />
        )}

        <BrowserIcon kind={node.kind} />
        <span className="browser-tree__label">{node.label}</span>
      </span>
    </div>
  );
}
