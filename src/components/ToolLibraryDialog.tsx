import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import {
  BLOCK_TYPE,
  LIBRARIES,
  displayName,
  framesFor,
  isBlockType,
  isHalfIndex,
  libraryById,
  solidSpanMm,
  stationNumber,
  toolsForLibrary,
  type LibraryToolRecord,
  type StoredJointFrames,
} from "../data/realLibrary";
import { ToolLibraryInsertPreview } from "./ToolLibraryInsertPreview";
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
  /** Restricts picking to tool blocks or to cutting tools. */
  pickKind?: "block" | "tool";
  onPick?: (toolId: string) => void;
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
function buildLibraryTree(): LibraryTreeNode[] {
  const rootLibraries = LIBRARIES.filter((library) => library.folder === null);
  const folders = new Map<string, typeof LIBRARIES>();

  for (const library of LIBRARIES) {
    if (library.folder === null) continue;
    const existing = folders.get(library.folder) ?? [];
    folders.set(library.folder, [...existing, library]);
  }

  const localChildren: LibraryTreeNode[] = [
    ...[...folders.entries()].map(([folder, contents]) => ({
      id: `folder-${folder}`,
      label: folder,
      selectable: false,
      defaultExpanded: true,
      children: contents.map((library) => ({
        id: library.id,
        label: library.name,
        selectable: true,
      })),
    })),
    ...rootLibraries.map((library) => ({
      id: library.id,
      label: library.name,
      selectable: true,
    })),
  ];

  return [
    {
      id: "user-libraries",
      label: "User Libraries",
      selectable: false,
      defaultExpanded: true,
      children: [
        { id: "documents", label: "Documents", selectable: false },
        { id: "cloud", label: "Cloud", selectable: false },
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

const LIBRARY_TREE = buildLibraryTree();

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
  onSelectLibrary,
}: {
  node: LibraryTreeNode;
  depth: number;
  selectedLibraryId: string;
  onSelectLibrary: (id: string) => void;
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
            onSelectLibrary={onSelectLibrary}
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
    >
      {node.label}
    </button>
  );
}

export function ToolLibraryDialog({
  open,
  onClose,
  onCreateTool,
  picker = false,
  initialLibraryId,
  pickKind,
  onPick,
}: ToolLibraryDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedLibraryId, setSelectedLibraryId] = useState(
    () => initialLibraryId ?? LIBRARIES[0]?.id ?? "",
  );
  const [selectedToolId, setSelectedToolId] = useState(
    () => toolsForLibrary(initialLibraryId ?? LIBRARIES[0]?.id ?? "")[0]?.id ?? "",
  );
  const [infoTab, setInfoTab] = useState<"filters" | "info">("info");
  const [showTurnedOff, setShowTurnedOff] = useState(true);

  const tools = useMemo(() => toolsForLibrary(selectedLibraryId), [selectedLibraryId]);

  const filteredTools = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tools.filter((tool) => {
      if (query !== "" && !displayName(tool).toLowerCase().includes(query)) {
        return false;
      }
      // In picker mode only offer items that can fill the chosen role.
      if (pickKind === "block") return isBlockType(tool.type);
      if (pickKind === "tool") return !isBlockType(tool.type);
      return true;
    });
  }, [tools, search, pickKind]);

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.id === selectedToolId) ?? filteredTools[0],
    [tools, selectedToolId, filteredTools],
  );

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
          <h2 id="tlb-title" className="tlb-head__title">
            {picker
              ? `Tool Library — select ${pickKind === "block" ? "tool block" : "cutting tool"}`
              : "Tool Library"}
          </h2>
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
              {LIBRARY_TREE.map((node) => (
                <LibraryTreeBranch
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedLibraryId={selectedLibraryId}
                  onSelectLibrary={handleLibrarySelect}
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
                  <ToolbarIconBtn label="Edit">
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
                <button type="button" className="tlb-toolbar__clear">
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
                    {filteredTools.length === 0 ? (
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
                            className={[
                              "tlb-table__row",
                              selectedTool?.id === tool.id ? "tlb-table__row--selected" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onClick={() => {
                              setSelectedToolId(tool.id);
                            }}
                            onDoubleClick={() => {
                              setSelectedToolId(tool.id);
                              if (picker) onPick?.(tool.id);
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
                <p style={{ color: "#9aa8b8", margin: 0 }}>Filter tools by type, vendor, or geometry (prototype).</p>
              ) : selectedTool !== undefined ? (
                <>
                  <p className="tlb-info__crumb">
                    {libraryById(selectedLibraryId)?.breadcrumb ?? "Tool library"}
                  </p>
                  <h3 className="tlb-info__title">{displayName(selectedTool)}</h3>
                  <div className="tlb-info__preview">
                    <ToolLibraryInsertPreview />
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
                disabled={pickableToolId === undefined}
                title={
                  pickableToolId === undefined
                    ? `This library item cannot be used as a ${
                        pickKind === "block" ? "tool block" : "cutting tool"
                      }`
                    : undefined
                }
                onClick={handlePick}
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
    </div>
  );
}
