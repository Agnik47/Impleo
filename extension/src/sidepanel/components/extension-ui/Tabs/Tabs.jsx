export default function Tabs({ tabs, activeId, onChange }) {
  return (
    <div
      role="tablist"
      className="grid grid-cols-4 gap-0.5 rounded-btn border border-surface-border bg-surface-card p-0.5"
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
          className={`min-h-[2.25rem] min-w-0 break-words rounded-btn px-1.5 py-1.5 text-center text-caption transition-colors duration-150 ${
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
