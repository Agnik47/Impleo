export default function Tabs({ tabs, activeId, onChange }) {
  return (
    <div
      role="tablist"
      className="no-scrollbar flex gap-0.5 overflow-x-auto rounded-btn border border-surface-border bg-surface-card p-0.5"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={tab.id === activeId}
          aria-controls={`panel-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={`grow shrink-0 whitespace-nowrap rounded-btn px-2.5 py-1 text-center text-caption transition-colors duration-150 ${
            tab.id === activeId
              ? 'bg-surface-card-hover text-brand'
              : 'text-ink-secondary hover:bg-surface-card-hover hover:text-ink-primary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
