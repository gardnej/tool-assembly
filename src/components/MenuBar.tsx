import "./chrome.css";

const ITEMS = ["File", "Edit", "View", "Insert", "Tools", "Window", "Help"];

export function MenuBar() {
  return (
    <nav className="menu-bar" aria-label="Application menu">
      {ITEMS.map((label) => (
        <button key={label} type="button" className="menu-bar__item">
          {label}
        </button>
      ))}
      <span className="menu-bar__spacer" />
      <span className="menu-bar__hint">Standalone prototype — not Fusion</span>
    </nav>
  );
}
