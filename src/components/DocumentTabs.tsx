import "./chrome.css";

type DocumentTabsProps = {
  documentTitle: string;
};

export function DocumentTabs({ documentTitle }: DocumentTabsProps) {
  return (
    <div className="doc-tabs" role="tablist" aria-label="Open documents">
      <button type="button" className="doc-tabs__tab doc-tabs__tab--active">
        <span className="doc-tabs__dot" aria-hidden />
        {documentTitle}
      </button>
    </div>
  );
}
