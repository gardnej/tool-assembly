import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import {
  DEFAULT_LIBRARY_ID,
  DEFAULT_TOOL_ID,
  libraryBreadcrumb,
  presetsForTool,
  toolsForLibrary,
  TOOL_LIBRARY_TREE,
  type LibraryTreeNode,
} from "../data/toolLibraryMock";
import { ToolLibraryInsertPreview } from "./ToolLibraryInsertPreview";
import "./tool-library-dialog.css";

interface ToolLibraryDialogProps {
  open: boolean;
  onClose: () => void;
  onCreateTool: () => void;
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

export function ToolLibraryDialog({ open, onClose, onCreateTool }: ToolLibraryDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedLibraryId, setSelectedLibraryId] = useState(DEFAULT_LIBRARY_ID);
  const [selectedToolId, setSelectedToolId] = useState(DEFAULT_TOOL_ID);
  const [infoTab, setInfoTab] = useState<"filters" | "info">("info");
  const [showTurnedOff, setShowTurnedOff] = useState(true);

  const tools = useMemo(() => toolsForLibrary(selectedLibraryId), [selectedLibraryId]);

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q === "") {
      return tools;
    }
    return tools.filter((t) => t.name.toLowerCase().includes(q));
  }, [tools, search]);

  const selectedTool = useMemo(
    () => tools.find((t) => t.id === selectedToolId) ?? filteredTools[0],
    [tools, selectedToolId, filteredTools],
  );

  const presets = useMemo(
    () => (selectedTool !== undefined ? presetsForTool(selectedTool.id) : []),
    [selectedTool],
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
    const nextTools = toolsForLibrary(libraryId);
    setSelectedToolId(nextTools[0]?.id ?? "");
  };

  return (
    <div className="tlb-overlay" role="presentation" onMouseDown={handleBackdrop}>
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
            Tool Library
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
              {TOOL_LIBRARY_TREE.map((node) => (
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
                  <ToolbarIconBtn label="New tool" accent onClick={onCreateTool}>
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                      <path fill="none" stroke="currentColor" strokeWidth="1.6" d="M8 3.5v9M3.5 8h9" />
                    </svg>
                  </ToolbarIconBtn>
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
                      <th>Corner radius</th>
                      <th>Overall length</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTools.map((tool) => (
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
                      >
                        <td>
                          <span className="tlb-table__name">
                            <span className="tlb-table__thumb" aria-hidden="true" />
                            {tool.name}
                          </span>
                        </td>
                        <td>{tool.cornerRadius}</td>
                        <td>{tool.overallLength}</td>
                        <td>{tool.type}</td>
                      </tr>
                    ))}
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
                    {presets.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ color: "#9aa8b8", padding: "12px 8px" }}>
                          No cutting data for this tool.
                        </td>
                      </tr>
                    ) : (
                      presets.map((preset) => (
                        <tr key={preset.id} className="tlb-table__row tlb-table__row--selected">
                          <td>{preset.name}</td>
                          <td>{preset.filterBySearch || "—"}</td>
                          <td>{preset.spindleSpeed}</td>
                          <td>{preset.surfaceSpeed}</td>
                          <td>{preset.cuttingFeedrate}</td>
                          <td>{preset.feedPerRev}</td>
                          <td>{preset.coolant}</td>
                        </tr>
                      ))
                    )}
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
                  <p className="tlb-info__crumb">{libraryBreadcrumb(selectedLibraryId)}</p>
                  <h3 className="tlb-info__title">{selectedTool.description}</h3>
                  <div className="tlb-info__preview">
                    <ToolLibraryInsertPreview />
                  </div>
                  <dl className="tlb-info__props">
                    <div className="tlb-info__prop">
                      <dt>Description</dt>
                      <dd>{selectedTool.description}</dd>
                    </div>
                    <div className="tlb-info__prop">
                      <dt>Shape</dt>
                      <dd>{selectedTool.shape}</dd>
                    </div>
                    <div className="tlb-info__prop">
                      <dt>Relief angle</dt>
                      <dd>{selectedTool.reliefAngle}</dd>
                    </div>
                    <div className="tlb-info__prop">
                      <dt>Tolerance</dt>
                      <dd>{selectedTool.tolerance}</dd>
                    </div>
                    <div className="tlb-info__prop">
                      <dt>Cross section</dt>
                      <dd>{selectedTool.crossSection}</dd>
                    </div>
                    <div className="tlb-info__prop">
                      <dt>Insert size</dt>
                      <dd>{selectedTool.insertSize}</dd>
                    </div>
                    <div className="tlb-info__prop">
                      <dt>Thickness</dt>
                      <dd>{selectedTool.thickness}</dd>
                    </div>
                    <div className="tlb-info__prop">
                      <dt>Corner radius</dt>
                      <dd>{selectedTool.cornerRadius}</dd>
                    </div>
                    <div className="tlb-info__prop">
                      <dt>Type</dt>
                      <dd>{selectedTool.type}</dd>
                    </div>
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
          <button type="button" className="tlb-footer__close" onClick={onClose}>
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
