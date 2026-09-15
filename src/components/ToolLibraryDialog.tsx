import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  BLOCK_TYPE,
  LIBRARIES,
  displayName,
  framesFor,
  isBlockType,
  isHalfIndex,
  libraries,
  libraryById,
  solidSpanMm,
  stationNumber,
  toolById,
  toolsForLibrary,
  type LibraryRef,
  type LibraryToolRecord,
  type StoredJointFrames,
} from "../data/realLibrary";
import {
  hideLibrary,
  isLibraryRenamed,
  removeSessionAssembly,
  renameLibrary,
  resetLibraryName,
  sessionAssembliesForLibrary,
} from "../data/libraryEdits";
import type { SavedAssembly } from "../types";
import { useLibraryRevision } from "../hooks/useLibraryRevision";
import { meshPreviewFor, ToolLibrarySolidPreview } from "./ToolLibrarySolidPreview";
import { ToolSilhouette } from "./ToolSilhouette";
import { ToolRecordEditor } from "./ToolRecordEditor";
import "./tool-library-dialog.css";

interface ToolLibraryDialogProps {
  open: boolean;
  onClose: () => void;
  onCreateTool?: () => void;
  /**
   * Picker mode turns the browser into a chooser: it opens on `initialLibraryId`,
   * swaps the footer for Select/Cancel, and reports the chosen library tool.
   */
  picker?: boolean;
  initialLibraryId?: string;
  /** Opens on this record, in the library that holds it. */
  initialToolId?: string;
  /** Opens the record's editor straight away, for an edit sent from elsewhere. */
  openEditor?: boolean;
  /** Restricts picking to tool blocks or to cutting tools. */
  pickKind?: "block" | "tool";
  /**
   * Picks a whole saved tool assembly (rather than a single tool record). The
   * table keeps its assembly rows visible in picker mode and the footer's
   * Select returns the chosen assembly's id.
   */
  pickAssembly?: boolean;
  onPickAssembly?: (assemblyId: string) => void;
  /**
   * What the picker is choosing, for the heading — e.g. "extension", "collet"
   * or "component". Components of different kinds often live in separate
   * libraries or folders, so the picker names what it is after rather than
   * assuming it is always a cutting tool.
   */
  pickLabel?: string;
  onPick?: (toolId: string) => void;
  /**
   * Called when the user picks Edit on a saved assembly. The parent should
   * close the browser and reopen the tool assembly dialog with the assembly
   * pre-loaded for editing.
   */
  onEditAssembly?: (assemblyId: string) => void;
  /**
   * Opens on this saved assembly, in the library that holds it. Used when a
   * fresh save wants to land the user on the assembly it just wrote.
   */
  initialAssemblyId?: string;
}

interface LibraryTreeNode {
  id: string;
  label: string;
  selectable?: boolean;
  defaultExpanded?: boolean;
  children?: LibraryTreeNode[];
}

/**
 * Folder tree over the real libraries, grouped the way they sit on disk under
 * Fusion's `libraries/Local` folder.
 */
function buildLibraryTree(refs: LibraryRef[]): LibraryTreeNode[] {
  const localRefs = refs.filter((library) => (library.parent ?? "local") === "local");
  const documentsRefs = refs.filter((library) => library.parent === "documents");
  const cloudRefs = refs.filter((library) => library.parent === "cloud");
  const hubRefs = refs.filter((library) => library.parent === "hub");

  /**
   * Group libraries by their ``folder`` field, keeping folder-less ones apart
   * so the caller can list them at the root of the category.
   */
  const groupByFolder = (list: LibraryRef[], keyPrefix: string): LibraryTreeNode[] => {
    const rootMembers = list.filter((library) => library.folder === null);
    const folders = new Map<string, LibraryRef[]>();
    for (const library of list) {
      if (library.folder === null) continue;
      const existing = folders.get(library.folder) ?? [];
      folders.set(library.folder, [...existing, library]);
    }
    return [
      ...[...folders.entries()].map(([folder, contents]) => ({
        id: `${keyPrefix}-folder-${folder}`,
        label: folder,
        selectable: false,
        defaultExpanded: true,
        children: contents.map((library) => ({
          id: library.id,
          label: library.name,
          selectable: true,
        })),
      })),
      ...rootMembers.map((library) => ({
        id: library.id,
        label: library.name,
        selectable: true,
      })),
    ];
  };

  const localChildren: LibraryTreeNode[] = groupByFolder(localRefs, "local");
  const hubChildren: LibraryTreeNode[] = groupByFolder(hubRefs, "hub");

  const asLeaves = (list: LibraryRef[]): LibraryTreeNode[] =>
    list.map((library) => ({ id: library.id, label: library.name, selectable: true }));

  return [
    {
      id: "user-libraries",
      label: "User Libraries",
      selectable: false,
      defaultExpanded: true,
      children: [
        {
          id: "documents",
          label: "Documents",
          selectable: false,
          defaultExpanded: documentsRefs.length > 0,
          children: asLeaves(documentsRefs),
        },
        {
          id: "cloud",
          label: "Cloud",
          selectable: false,
          defaultExpanded: cloudRefs.length > 0,
          children: asLeaves(cloudRefs),
        },
        {
          id: "hub",
          label: "Hub",
          selectable: false,
          defaultExpanded: true,
          children: hubChildren,
        },
        {
          id: "local",
          label: "Local",
          selectable: false,
          defaultExpanded: true,
          children: localChildren,
        },
      ],
    },
  ];
}

/**
 * Joint readiness for a stored solid. Fusion imports these frames from the STEP
 * file, so a gap is what stops an assembly coming together.
 */
function jointSummary(frames: StoredJointFrames | undefined): string {
  if (frames === undefined) return "No solid";
  if (frames.mcs === null && frames.csw === null) return "None";
  if (frames.mcs === null) return "No MCS";
  if (frames.csw === null) return "No CSW";
  return "MCS + CSW";
}

/** Overall length as the library records it, for the table's length column. */
function overallLength(tool: LibraryToolRecord): string {
  const value = tool.geometry.OAL;
  if (typeof value === "number") return `${value} mm`;
  const span = solidSpanMm(tool.geometryId);
  return span !== null ? `${span.toFixed(2)} mm` : "—";
}

function ToolbarIconBtn({
  label,
  accent,
  onClick,
  children,
}: {
  label: string;
  accent?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={[
        "tlb-toolbar__btn",
        accent === true ? "tlb-toolbar__btn--accent" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * Filters the browser applies to the current library.
 *
 * Sets rather than arrays so many-of choices toggle cheaply; the search term
 * lives on the toolbar itself, since it is one input rather than a stack of
 * checkboxes.
 */
interface Filters {
  /** Show only tool blocks — the machine-side root of an assembly. */
  blockOnly: boolean;
  types: Set<string>;
  vendors: Set<string>;
}

function emptyFilters(): Filters {
  return { blockOnly: false, types: new Set(), vendors: new Set() };
}

function hasActiveFilters(filters: Filters): boolean {
  return filters.blockOnly || filters.types.size > 0 || filters.vendors.size > 0;
}

/** Toggle one entry of a set-valued filter without mutating the previous state. */
function toggleIn(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

function FiltersPanel({
  filters,
  onChange,
  types,
  vendors,
  resultCount,
  totalCount,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  types: string[];
  vendors: string[];
  resultCount: number;
  totalCount: number;
}) {
  return (
    <div className="tlb-filters">
      <p className="tlb-info__crumb">
        Showing {resultCount} of {totalCount}
        {hasActiveFilters(filters) ? " (filtered)" : ""}
      </p>

      <FilterGroup title="Kind">
        <FilterCheckbox
          label="Tool block"
          hint="Only tool blocks — the machine-side root of an assembly."
          checked={filters.blockOnly}
          onChange={(checked) => onChange({ ...filters, blockOnly: checked })}
        />
      </FilterGroup>

      <FilterGroup title="Type">
        {types.length === 0 ? (
          <p className="tlb-filters__empty">No tools in this library.</p>
        ) : (
          types.map((type) => (
            <FilterCheckbox
              key={type}
              label={type}
              checked={filters.types.has(type)}
              onChange={() =>
                onChange({ ...filters, types: toggleIn(filters.types, type) })
              }
            />
          ))
        )}
      </FilterGroup>

      {vendors.length > 0 && (
        <FilterGroup title="Vendor">
          {vendors.map((vendor) => (
            <FilterCheckbox
              key={vendor}
              label={vendor}
              checked={filters.vendors.has(vendor)}
              onChange={() =>
                onChange({ ...filters, vendors: toggleIn(filters.vendors, vendor) })
              }
            />
          ))}
        </FilterGroup>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tlb-filters__group">
      <h4 className="tlb-filters__title">{title}</h4>
      <div className="tlb-filters__items">{children}</div>
    </section>
  );
}

function FilterCheckbox({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="tlb-filters__item" title={hint}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function InfoProp({ label, value }: { label: string; value: string }) {
  return (
    <div className="tlb-info__prop">
      <dt>{label}</dt>
      <dd>{value !== "" ? value : "—"}</dd>
    </div>
  );
}

function LibraryTreeBranch({
  node,
  depth,
  selectedLibraryId,
  renamingId,
  onSelectLibrary,
  onContextMenu,
  onCommitRename,
  onCancelRename,
}: {
  node: LibraryTreeNode;
  depth: number;
  selectedLibraryId: string;
  renamingId: string | null;
  onSelectLibrary: (id: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
  onCommitRename: (id: string, name: string) => void;
  onCancelRename: () => void;
}) {
  const hasChildren = node.children !== undefined && node.children.length > 0;
  const isSelectable = node.selectable === true;

  if (hasChildren) {
    return (
      <details className="tlb-tree__folder" open={node.defaultExpanded === true}>
        <summary className="tlb-tree__summary" style={{ paddingLeft: `${6 + depth * 10}px` }}>
          {node.label}
        </summary>
        {node.children?.map((child) => (
          <LibraryTreeBranch
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedLibraryId={selectedLibraryId}
            renamingId={renamingId}
            onSelectLibrary={onSelectLibrary}
            onContextMenu={onContextMenu}
            onCommitRename={onCommitRename}
            onCancelRename={onCancelRename}
          />
        ))}
      </details>
    );
  }

  if (!isSelectable) {
    return (
      <div className="tlb-tree__leaf" style={{ paddingLeft: `${18 + depth * 10}px`, cursor: "default" }}>
        {node.label}
      </div>
    );
  }

  if (renamingId === node.id) {
    return (
      <LibraryNameInput
        name={node.label}
        depth={depth}
        onCommit={(name) => {
          onCommitRename(node.id, name);
        }}
        onCancel={onCancelRename}
      />
    );
  }

  return (
    <button
      type="button"
      className={[
        "tlb-tree__leaf",
        selectedLibraryId === node.id ? "tlb-tree__leaf--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ paddingLeft: `${18 + depth * 10}px` }}
      onClick={() => {
        onSelectLibrary(node.id);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onSelectLibrary(node.id);
        onContextMenu(node.id, event.clientX, event.clientY);
      }}
    >
      {node.label}
    </button>
  );
}

/** The leaf while it is being renamed: Enter or blur keeps it, Escape drops it. */
function LibraryNameInput({
  name,
  depth,
  onCommit,
  onCancel,
}: {
  name: string;
  depth: number;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(name);

  return (
    <input
      className="tlb-tree__rename"
      style={{ marginLeft: `${18 + depth * 10}px` }}
      value={value}
      autoFocus
      aria-label={`Rename ${name}`}
      onFocus={(event) => {
        event.target.select();
      }}
      onChange={(event) => {
        setValue(event.target.value);
      }}
      onBlur={() => {
        onCommit(value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") onCommit(value);
        if (event.key === "Escape") onCancel();
      }}
    />
  );
}

/** Right-click menu over a library in the tree. */
function LibraryContextMenu({
  x,
  y,
  renamed,
  onRename,
  onReset,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  renamed: boolean;
  onRename: () => void;
  onReset: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const dismiss = () => {
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("mousedown", dismiss);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="tlb-menu"
      role="menu"
      style={{ top: y, left: x }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
    >
      <button type="button" className="tlb-menu__item" role="menuitem" onClick={onRename}>
        Rename
      </button>
      <button
        type="button"
        className="tlb-menu__item"
        role="menuitem"
        disabled={!renamed}
        title={renamed ? undefined : "This library still has its exported name"}
        onClick={onReset}
      >
        Reset name
      </button>
      <div className="tlb-menu__separator" role="separator" />
      <button
        type="button"
        className="tlb-menu__item tlb-menu__item--danger"
        role="menuitem"
        onClick={onDelete}
        title="Remove this library from the browser for this session"
      >
        Delete
      </button>
    </div>
  );
}

function AssemblyContextMenu({
  x,
  y,
  onEdit,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const dismiss = () => {
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("mousedown", dismiss);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="tlb-menu"
      role="menu"
      style={{ top: y, left: x }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
    >
      <button type="button" className="tlb-menu__item" role="menuitem" onClick={onEdit}>
        Edit assembly
      </button>
      <div className="tlb-menu__separator" role="separator" />
      <button
        type="button"
        className="tlb-menu__item tlb-menu__item--danger"
        role="menuitem"
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
}

/**
 * Rows for the saved-assembly accordion.
 *
 * Each saved assembly gets a row of its own with an expand chevron; when
 * expanded, its block plus every component in every position is listed
 * beneath it, indented, so the user can see what the assembly holds without
 * leaving the browser.
 */
function AssemblyRows({
  assemblies,
  expanded,
  selectedAssemblyId,
  selectedToolId,
  onToggle,
  onSelectAssembly,
  onSelectComponent,
  onEdit,
  onOpenMenu,
}: {
  assemblies: SavedAssembly[];
  expanded: Set<string>;
  selectedAssemblyId: string | null;
  selectedToolId: string;
  onToggle: (id: string) => void;
  onSelectAssembly: (id: string) => void;
  onSelectComponent: (toolId: string) => void;
  onEdit: (id: string) => void;
  onOpenMenu: (id: string, x: number, y: number) => void;
}) {
  return (
    <>
      {assemblies.map((assembly) => {
        const isOpen = expanded.has(assembly.id);
        const componentIds = [
          ...(assembly.blockToolId ? [assembly.blockToolId] : []),
          ...assembly.slots.flatMap((slot) => slot.stack),
        ];
        return (
          <Fragment key={assembly.id}>
            <tr
              className={[
                "tlb-table__row",
                "tlb-table__row--assembly",
                selectedAssemblyId === assembly.id ? "tlb-table__row--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                onSelectAssembly(assembly.id);
              }}
              onDoubleClick={() => {
                onEdit(assembly.id);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                onOpenMenu(assembly.id, event.clientX, event.clientY);
              }}
            >
              <td>
                <span className="tlb-table__name">
                  <button
                    type="button"
                    className="tlb-table__chevron"
                    aria-label={isOpen ? "Collapse assembly" : "Expand assembly"}
                    aria-expanded={isOpen}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggle(assembly.id);
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                      <path
                        d={isOpen ? "M1 3 L5 7 L9 3" : "M3 1 L7 5 L3 9"}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <span className="tlb-table__thumb" aria-hidden="true" />
                  {assembly.name}
                </span>
              </td>
              <td>Tool assembly</td>
              <td>—</td>
              <td>—</td>
              <td>{`${componentIds.length} component${componentIds.length === 1 ? "" : "s"}`}</td>
            </tr>
            {isOpen &&
              componentIds.map((id, index) => {
                const record = toolById(id);
                if (record === undefined) return null;
                const station = stationNumber(record);
                const frames = framesFor(record.geometryId);
                return (
                  <tr
                    key={`${assembly.id}-${index}-${id}`}
                    className={[
                      "tlb-table__row",
                      "tlb-table__row--child",
                      selectedToolId === id ? "tlb-table__row--selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      onSelectComponent(id);
                    }}
                  >
                    <td>
                      <span
                        className="tlb-table__name"
                        style={{ paddingLeft: 28 }}
                      >
                        <span className="tlb-table__thumb" aria-hidden="true" />
                        {displayName(record)}
                      </span>
                    </td>
                    <td>{record.type}</td>
                    <td>{overallLength(record)}</td>
                    <td>{station !== null ? station : "—"}</td>
                    <td>{jointSummary(frames)}</td>
                  </tr>
                );
              })}
          </Fragment>
        );
      })}
    </>
  );
}

/**
 * Info-panel view for a saved assembly.
 *
 * Shows a block preview plus a per-position component list so the panel reads
 * as an assembled tool rather than a single record. Clicking a component in
 * the list drills into that component's own record view — the ordinary
 * ``selectedTool`` pane — mirroring how the accordion works in the table.
 */
function AssemblyInfo({
  assembly,
  breadcrumb,
  onSelectComponent,
}: {
  assembly: SavedAssembly;
  breadcrumb: string;
  onSelectComponent: (toolId: string) => void;
}) {
  const blockRecord =
    assembly.blockToolId === null
      ? null
      : toolById(assembly.blockToolId) ?? null;
  const blockMesh = blockRecord === null ? null : meshPreviewFor(blockRecord);
  const totalComponents =
    (blockRecord === null ? 0 : 1) +
    assembly.slots.reduce((sum, slot) => sum + slot.stack.length, 0);

  return (
    <>
      <p className="tlb-info__crumb">{breadcrumb}</p>
      <h3 className="tlb-info__title">{assembly.name}</h3>
      <div className="tlb-info__preview">
        {blockMesh !== null && blockRecord !== null ? (
          <ToolLibrarySolidPreview preview={blockMesh} />
        ) : blockRecord !== null ? (
          <ToolSilhouette record={blockRecord} className="tlb-info__art" />
        ) : (
          <div className="tlb-info__art tlb-info__art--empty">No block</div>
        )}
        <span className="tlb-info__cube" aria-hidden="true">
          FRONT
        </span>
      </div>
      <dl className="tlb-info__props">
        <InfoProp label="Type" value="Tool assembly" />
        <InfoProp
          label="Block"
          value={blockRecord === null ? "—" : displayName(blockRecord)}
        />
        <InfoProp label="Vendor" value={assembly.vendor === "" ? "—" : assembly.vendor} />
        <InfoProp
          label="Product ID"
          value={assembly.productId === "" ? "—" : assembly.productId}
        />
        <InfoProp label="Positions" value={String(assembly.slots.length)} />
        <InfoProp label="Total components" value={String(totalComponents)} />
      </dl>

      <div className="tlb-info__section-title">Components</div>
      <ul className="tlb-info__components">
        {blockRecord !== null && (
          <li>
            <button
              type="button"
              className="tlb-info__component"
              onClick={() => onSelectComponent(blockRecord.id)}
            >
              <span className="tlb-info__component-label">Block</span>
              <span className="tlb-info__component-name">{displayName(blockRecord)}</span>
            </button>
          </li>
        )}
        {assembly.slots.map((slot, slotIndex) =>
          slot.stack.map((toolId, depth) => {
            const record = toolById(toolId);
            if (record === undefined) return null;
            return (
              <li key={`${slotIndex}-${depth}-${toolId}`}>
                <button
                  type="button"
                  className="tlb-info__component"
                  onClick={() => onSelectComponent(toolId)}
                >
                  <span className="tlb-info__component-label">
                    Position {slot.stationNumber ?? slotIndex + 1}
                    {slot.stack.length > 1 ? ` · Layer ${depth + 1}` : ""}
                  </span>
                  <span className="tlb-info__component-name">{displayName(record)}</span>
                </button>
              </li>
            );
          }),
        )}
      </ul>
    </>
  );
}

export function ToolLibraryDialog({
  open,
  onClose,
  onCreateTool,
  picker = false,
  initialLibraryId,
  initialToolId,
  openEditor = false,
  pickKind,
  pickLabel,
  onPick,
  pickAssembly = false,
  onPickAssembly,
  onEditAssembly,
  initialAssemblyId,
}: ToolLibraryDialogProps) {
  const initialTool = initialToolId === undefined ? undefined : toolById(initialToolId);
  const [search, setSearch] = useState("");
  const [selectedLibraryId, setSelectedLibraryId] = useState(
    () => initialTool?.libraryId ?? initialLibraryId ?? LIBRARIES[0]?.id ?? "",
  );
  const [selectedToolId, setSelectedToolId] = useState(
    () =>
      initialTool?.id ??
      toolsForLibrary(initialLibraryId ?? LIBRARIES[0]?.id ?? "")[0]?.id ??
      "",
  );
  const [infoTab, setInfoTab] = useState<"filters" | "info">("info");
  /**
   * Filters live here rather than on the workflow, because they are the way the
   * user prunes what a picker offers — outside picker mode they only limit
   * what the browser lists, without changing the assembly.
   */
  const [filters, setFilters] = useState<Filters>(() => emptyFilters());
  /** Brings the record the caller asked for into view when the list is long. */
  const revealRef = useRef<HTMLTableRowElement | null>(null);
  const [showTurnedOff, setShowTurnedOff] = useState(true);
  const [editing, setEditing] = useState(openEditor);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  /** Assemblies whose component list is expanded, keyed by id. */
  const [expandedAssemblies, setExpandedAssemblies] = useState<Set<string>>(
    () => (initialAssemblyId ? new Set([initialAssemblyId]) : new Set()),
  );
  /** Saved assembly the user picked in the list, if any. */
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string | null>(
    initialAssemblyId ?? null,
  );
  /** Assembly the user right-clicked, for its own context menu. */
  const [assemblyMenu, setAssemblyMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const editRevision = useLibraryRevision();

  const tree = useMemo(() => buildLibraryTree(libraries()), [editRevision]);

  const tools = useMemo(
    () => toolsForLibrary(selectedLibraryId),
    [selectedLibraryId, editRevision],
  );

  /** Saved assemblies stored under this library, if any. */
  const assemblies = useMemo(
    () => sessionAssembliesForLibrary(selectedLibraryId),
    [selectedLibraryId, editRevision],
  );

  const filteredAssemblies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === "") return assemblies;
    return assemblies.filter((assembly) =>
      assembly.name.toLowerCase().includes(query),
    );
  }, [assemblies, search]);

  const selectedAssembly = useMemo(
    () =>
      selectedAssemblyId === null
        ? undefined
        : assemblies.find((assembly) => assembly.id === selectedAssemblyId),
    [assemblies, selectedAssemblyId],
  );

  const toggleAssemblyExpanded = useCallback((id: string) => {
    setExpandedAssemblies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Types and vendors on offer for the filters panel, from the current library. */
  const typesInLibrary = useMemo(
    () => Array.from(new Set(tools.map((tool) => tool.type))).sort(),
    [tools],
  );
  const vendorsInLibrary = useMemo(
    () =>
      Array.from(new Set(tools.map((tool) => tool.vendor).filter((v) => v !== ""))).sort(),
    [tools],
  );

  const filteredTools = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tools.filter((tool) => {
      if (query !== "" && !displayName(tool).toLowerCase().includes(query)) {
        return false;
      }
      if (filters.blockOnly && !isBlockType(tool.type)) return false;
      if (filters.types.size > 0 && !filters.types.has(tool.type)) return false;
      if (filters.vendors.size > 0 && !filters.vendors.has(tool.vendor)) return false;
      // In picker mode only offer items that can fill the chosen role.
      if (pickKind === "block") return isBlockType(tool.type);
      if (pickKind === "tool") return !isBlockType(tool.type);
      return true;
    });
  }, [tools, search, pickKind, filters]);

  const selectedTool = useMemo(
    () =>
      tools.find((tool) => tool.id === selectedToolId) ??
      // Drilling into a saved-assembly component reaches records that live in
      // other libraries than the one selected in the tree — fall back to the
      // global accessor so the info pane can still preview those tools.
      toolById(selectedToolId) ??
      filteredTools[0],
    [tools, selectedToolId, filteredTools],
  );

  useEffect(() => {
    revealRef.current?.scrollIntoView({ block: "center" });
  }, []);

  if (!open) {
    return null;
  }

  const handleBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleLibrarySelect = (libraryId: string) => {
    setSelectedLibraryId(libraryId);
    setSelectedToolId(toolsForLibrary(libraryId)[0]?.id ?? "");
    setSelectedAssemblyId(null);
  };

  const wrongKind =
    selectedTool !== undefined &&
    ((pickKind === "block" && !isBlockType(selectedTool.type)) ||
      (pickKind === "tool" && isBlockType(selectedTool.type)));

  const pickableToolId =
    selectedTool !== undefined && !wrongKind ? selectedTool.id : undefined;

  const handlePick = () => {
    if (pickableToolId === undefined) return;
    onPick?.(pickableToolId);
  };

  return (
    <div
      className={["tlb-overlay", picker ? "tlb-overlay--picker" : ""].filter(Boolean).join(" ")}
      role="presentation"
      onMouseDown={handleBackdrop}
    >
      <section
        className="tlb-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tlb-title"
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <header className="tlb-head">
          <div className="tlb-traffic" aria-hidden="true">
            <span className="tlb-traffic__dot tlb-traffic__dot--red" />
            <span className="tlb-traffic__dot tlb-traffic__dot--yellow" />
            <span className="tlb-traffic__dot tlb-traffic__dot--green" />
          </div>
          <div className="tlb-head__titlewrap">
            <h2 id="tlb-title" className="tlb-head__title">
              {picker
                ? `Tool Library — select ${
                    pickAssembly
                      ? "assembly"
                      : pickLabel ?? (pickKind === "block" ? "tool block" : "cutting tool")
                  }`
                : "Tool Library"}
            </h2>
            {picker && (
              <span className="tlb-head__hint">
                {pickAssembly
                  ? "Pick one of your saved tool assemblies to mount on the station."
                  : "Browse any library or folder in the tree — compatible components may live in different locations."}
              </span>
            )}
          </div>
          <span className="tlb-head__spacer" aria-hidden="true" />
        </header>

        <div className="tlb-body">
          <aside className="tlb-nav" aria-label="Library folders">
            <input
              type="search"
              className="tlb-search"
              placeholder="Search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              aria-label="Search libraries"
            />
            <nav className="tlb-tree">
              {tree.map((node) => (
                <LibraryTreeBranch
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedLibraryId={selectedLibraryId}
                  renamingId={renamingId}
                  onSelectLibrary={handleLibrarySelect}
                  onContextMenu={(id, x, y) => {
                    setMenu({ id, x, y });
                  }}
                  onCommitRename={(id, name) => {
                    renameLibrary(id, name);
                    setRenamingId(null);
                  }}
                  onCancelRename={() => {
                    setRenamingId(null);
                  }}
                />
              ))}
            </nav>
            <div className="tlb-nav__footer">
              <p className="tlb-nav__vendor">Vendor</p>
              <label className="tlb-checkbox">
                <input
                  type="checkbox"
                  checked={showTurnedOff}
                  onChange={(e) => {
                    setShowTurnedOff(e.target.checked);
                  }}
                />
                Show turned off libraries
              </label>
            </div>
          </aside>

          <div className="tlb-center">
            <section className="tlb-pane tlb-pane--tools" aria-label="Tools">
              <div className="tlb-toolbar">
                <div className="tlb-toolbar__tools">
                  {onCreateTool !== undefined && (
                    <ToolbarIconBtn label="New tool" accent onClick={onCreateTool}>
                      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                        <path fill="none" stroke="currentColor" strokeWidth="1.6" d="M8 3.5v9M3.5 8h9" />
                      </svg>
                    </ToolbarIconBtn>
                  )}
                  <ToolbarIconBtn
                    label="Edit"
                    onClick={() => {
                      if (selectedTool !== undefined) setEditing(true);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                      <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        d="M11 2l3 3-8 8H3v-3l8-8z"
                      />
                    </svg>
                  </ToolbarIconBtn>
                  <ToolbarIconBtn label="Copy">
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                      <rect x="5" y="5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="3" y="3" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  </ToolbarIconBtn>
                  <ToolbarIconBtn label="Paste">
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                      <path fill="currentColor" d="M5 2h6v2H5V2zm-1 2h8v10H4V4z" opacity="0.85" />
                    </svg>
                  </ToolbarIconBtn>
                  <ToolbarIconBtn label="Duplicate">
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                      <rect x="2" y="4" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="6" y="2" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  </ToolbarIconBtn>
                  <ToolbarIconBtn label="Delete">
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                      <path fill="currentColor" d="M4 5h8l-.8 8H4.8L4 5zm2-2h4v1H6V3z" opacity="0.9" />
                    </svg>
                  </ToolbarIconBtn>
                </div>
                <span className="tlb-toolbar__spacer" />
                <button
                  type="button"
                  className="tlb-toolbar__clear"
                  disabled={!hasActiveFilters(filters) && search === ""}
                  onClick={() => {
                    setFilters(emptyFilters());
                    setSearch("");
                  }}
                >
                  Clear filters
                </button>
              </div>
              <div className="tlb-table-wrap">
                <table className="tlb-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Overall length</th>
                      <th>Station</th>
                      <th>Joint frames</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!picker || pickAssembly) && filteredAssemblies.length > 0 && (
                      <AssemblyRows
                        assemblies={filteredAssemblies}
                        expanded={expandedAssemblies}
                        selectedAssemblyId={selectedAssemblyId}
                        selectedToolId={selectedToolId}
                        onToggle={toggleAssemblyExpanded}
                        onSelectAssembly={(id) => {
                          setSelectedAssemblyId(id);
                        }}
                        onSelectComponent={(toolId) => {
                          setSelectedAssemblyId(null);
                          setSelectedToolId(toolId);
                        }}
                        onEdit={(id) => {
                          // In assembly-picker mode a double-click is a pick;
                          // otherwise it opens the assembly for editing.
                          if (pickAssembly) onPickAssembly?.(id);
                          else onEditAssembly?.(id);
                        }}
                        onOpenMenu={(id, x, y) => {
                          setAssemblyMenu({ id, x, y });
                        }}
                      />
                    )}
                    {filteredTools.length === 0 && filteredAssemblies.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ color: "#9aa8b8", padding: "12px 8px" }}>
                          {pickKind === "block"
                            ? "No tool blocks in this library."
                            : "No tools match."}
                        </td>
                      </tr>
                    ) : (
                      filteredTools.map((tool) => {
                        const station = stationNumber(tool);
                        const frames = framesFor(tool.geometryId);

                        return (
                          <tr
                            key={tool.id}
                            ref={tool.id === initialToolId ? revealRef : undefined}
                            className={[
                              "tlb-table__row",
                              selectedTool?.id === tool.id ? "tlb-table__row--selected" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onClick={() => {
                              setSelectedToolId(tool.id);
                              setSelectedAssemblyId(null);
                            }}
                            onDoubleClick={() => {
                              setSelectedToolId(tool.id);
                              setSelectedAssemblyId(null);
                              if (picker) onPick?.(tool.id);
                              else setEditing(true);
                            }}
                          >
                            <td>
                              <span className="tlb-table__name">
                                <span className="tlb-table__thumb" aria-hidden="true" />
                                {displayName(tool)}
                              </span>
                            </td>
                            <td>{tool.type}</td>
                            <td>{overallLength(tool)}</td>
                            <td>{station !== null ? station : "—"}</td>
                            <td>{jointSummary(frames)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="tlb-pane tlb-pane--presets" aria-label="Cutting data">
              <div className="tlb-toolbar">
                <div className="tlb-toolbar__tools">
                  <ToolbarIconBtn label="Edit preset">
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                      <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        d="M11 2l3 3-8 8H3v-3l8-8z"
                      />
                    </svg>
                  </ToolbarIconBtn>
                  <ToolbarIconBtn label="Copy preset">
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                      <rect x="5" y="5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="3" y="3" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  </ToolbarIconBtn>
                  <ToolbarIconBtn label="Paste preset">
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                      <path fill="currentColor" d="M5 2h6v2H5V2zm-1 2h8v10H4V4z" opacity="0.85" />
                    </svg>
                  </ToolbarIconBtn>
                  <ToolbarIconBtn label="Delete preset">
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                      <path fill="currentColor" d="M4 5h8l-.8 8H4.8L4 5zm2-2h4v1H6V3z" opacity="0.9" />
                    </svg>
                  </ToolbarIconBtn>
                </div>
              </div>
              <div className="tlb-table-wrap">
                <table className="tlb-table">
                  <thead>
                    <tr>
                      <th>Cutting data</th>
                      <th>Filter by search</th>
                      <th>Spindle speed</th>
                      <th>Surface speed</th>
                      <th>Cutting feedrate</th>
                      <th>Cutting feedrate per revolution</th>
                      <th>Coolant</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={7} style={{ color: "#9aa8b8", padding: "12px 8px" }}>
                        Cutting presets are not carried in the library snapshot.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="tlb-info" aria-label="Tool information">
            <div className="tlb-info__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={["tlb-info__tab", infoTab === "filters" ? "tlb-info__tab--active" : ""]
                  .filter(Boolean)
                  .join(" ")}
                aria-selected={infoTab === "filters"}
                onClick={() => {
                  setInfoTab("filters");
                }}
              >
                Filters
              </button>
              <button
                type="button"
                role="tab"
                className={["tlb-info__tab", infoTab === "info" ? "tlb-info__tab--active" : ""]
                  .filter(Boolean)
                  .join(" ")}
                aria-selected={infoTab === "info"}
                onClick={() => {
                  setInfoTab("info");
                }}
              >
                Info
              </button>
            </div>
            <div className="tlb-info__body">
              {infoTab === "filters" ? (
                <FiltersPanel
                  filters={filters}
                  onChange={setFilters}
                  types={typesInLibrary}
                  vendors={vendorsInLibrary}
                  resultCount={filteredTools.length}
                  totalCount={tools.length}
                />
              ) : selectedAssembly !== undefined ? (
                <AssemblyInfo
                  assembly={selectedAssembly}
                  breadcrumb={libraryById(selectedLibraryId)?.breadcrumb ?? "Tool library"}
                  onSelectComponent={(toolId) => {
                    setSelectedAssemblyId(null);
                    setSelectedToolId(toolId);
                  }}
                />
              ) : selectedTool !== undefined ? (
                <>
                  <p className="tlb-info__crumb">
                    {libraryById(selectedLibraryId)?.breadcrumb ?? "Tool library"}
                  </p>
                  <h3 className="tlb-info__title">{displayName(selectedTool)}</h3>
                  <div className="tlb-info__preview">
                    {(() => {
                      const mesh = meshPreviewFor(selectedTool);
                      return mesh !== null ? (
                        <ToolLibrarySolidPreview preview={mesh} />
                      ) : (
                        <ToolSilhouette
                          record={selectedTool}
                          className="tlb-info__art"
                        />
                      );
                    })()}
                    <span className="tlb-info__cube" aria-hidden="true">
                      FRONT
                    </span>
                  </div>
                  <dl className="tlb-info__props">
                    <InfoProp label="Type" value={selectedTool.type} />
                    <InfoProp label="Vendor" value={selectedTool.vendor} />
                    <InfoProp label="Product ID" value={selectedTool.productId} />
                    <InfoProp label="Unit" value={selectedTool.unit} />
                    <InfoProp
                      label="Overall length"
                      value={overallLength(selectedTool)}
                    />
                    <InfoProp
                      label="Turret station"
                      value={
                        stationNumber(selectedTool) !== null
                          ? `${stationNumber(selectedTool)}${
                              isHalfIndex(selectedTool) ? " (half index)" : ""
                            }`
                          : "—"
                      }
                    />
                    <InfoProp
                      label="Joint frames"
                      value={jointSummary(framesFor(selectedTool.geometryId))}
                    />
                    <InfoProp
                      label="STEP file"
                      value={selectedTool.stepFileName ?? "—"}
                    />
                    <InfoProp
                      label="Carries block"
                      value={
                        selectedTool.block !== null
                          ? selectedTool.block.description || BLOCK_TYPE
                          : "—"
                      }
                    />
                  </dl>
                </>
              ) : (
                <p style={{ color: "#9aa8b8", margin: 0 }}>Select a tool to view details.</p>
              )}
            </div>
          </aside>
        </div>

        <footer className="tlb-footer">
          <span className="tlb-footer__version">v2.13.4 Online</span>
          {picker ? (
            <div className="tlb-footer__actions">
              <button
                type="button"
                className="tlb-footer__select"
                disabled={
                  pickAssembly
                    ? selectedAssembly === undefined
                    : pickableToolId === undefined
                }
                title={
                  pickAssembly
                    ? selectedAssembly === undefined
                      ? "Select one of your saved assemblies first"
                      : undefined
                    : pickableToolId === undefined
                      ? `This library item cannot be used as a ${
                          pickLabel ??
                          (pickKind === "block" ? "tool block" : "cutting tool")
                        }`
                      : undefined
                }
                onClick={() => {
                  if (pickAssembly) {
                    if (selectedAssembly !== undefined) onPickAssembly?.(selectedAssembly.id);
                  } else {
                    handlePick();
                  }
                }}
              >
                Select
              </button>
              <button type="button" className="tlb-footer__close" onClick={onClose}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="tlb-footer__close" onClick={onClose}>
              Close
            </button>
          )}
        </footer>
      </section>

      {menu !== null && (
        <LibraryContextMenu
          x={menu.x}
          y={menu.y}
          renamed={isLibraryRenamed(menu.id)}
          onRename={() => {
            setRenamingId(menu.id);
            setMenu(null);
          }}
          onReset={() => {
            resetLibraryName(menu.id);
            setMenu(null);
          }}
          onDelete={() => {
            hideLibrary(menu.id);
            // If the deleted library was the one on screen, hop to whichever
            // library still has records, so the info pane never points at a
            // library the tree can no longer reach.
            if (menu.id === selectedLibraryId) {
              const next = libraries().find((library) => library.id !== menu.id);
              if (next !== undefined) setSelectedLibraryId(next.id);
            }
            setMenu(null);
          }}
          onClose={() => {
            setMenu(null);
          }}
        />
      )}

      {assemblyMenu !== null && (
        <AssemblyContextMenu
          x={assemblyMenu.x}
          y={assemblyMenu.y}
          onEdit={() => {
            onEditAssembly?.(assemblyMenu.id);
            setAssemblyMenu(null);
          }}
          onDelete={() => {
            removeSessionAssembly(assemblyMenu.id);
            setAssemblyMenu(null);
          }}
          onClose={() => {
            setAssemblyMenu(null);
          }}
        />
      )}

      {editing && selectedTool !== undefined && (
        <ToolRecordEditor
          record={selectedTool}
          onClose={() => {
            setEditing(false);
            // Callers that opened the library only to edit — the assembly's
            // "Edit in library" button, chiefly — expect to be handed back
            // straight from the editor, without the library sitting in front.
            if (openEditor) onClose();
          }}
        />
      )}
    </div>
  );
}
