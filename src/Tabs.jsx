import { useCallback, useRef, useState } from 'react';

export default function Tabs({ className, activeClassName, label, value, onChange, tabs, panelId }) {
  const [internal, setInternal] = useState(value ?? tabs?.[0]?.id ?? tabs?.[0]?.value ?? '');
  const actual = panelId ? value : (value ?? internal);
  const listRef = useRef(null);

  const focusIndex = (index) => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.querySelectorAll('[role="tab"]'));
    const target = items[index];
    if (target) target.focus();
  };

  const handleKeyDown = useCallback(
    (event, index) => {
      const total = tabs.length;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        focusIndex((index + 1) % total);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        focusIndex(((index - 1 + total) % total));
      } else if (event.key === 'Home') {
        event.preventDefault();
        focusIndex(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        focusIndex(total - 1);
      } else if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        const tab = tabs[index];
        if (tab) select(tab.id ?? tab.value);
      }
    },
    [tabs],
  );

  const select = useCallback(
    (next) => {
      if (panelId) {
        onChange(next);
      } else {
        setInternal(next);
        onChange(next);
      }
    },
    [panelId, onChange],
  );

  return (
    <div className={`tablist-wrapper${className ? ` ${className}` : ''}`}>
      {label && (
        <span className="tablist-label" id={panelId ? `${panelId}-label` : undefined}>
          {label}
        </span>
      )}
      <div
        ref={listRef}
        className="tablist"
        role="tablist"
        aria-label={label}
        aria-labelledby={label && panelId ? `${panelId}-label` : undefined}
      >
        {tabs.map((tab, index) => {
          const idOrValue = tab.id ?? tab.value;
          const isActive = idOrValue === actual;
          const classes = [className, isActive && activeClassName].filter(Boolean).join(' ');
          return (
            <button
              key={idOrValue}
              type="button"
              className={classes}
              role="tab"
              id={idOrValue}
              aria-selected={isActive}
              aria-controls={panelId ? panelId : undefined}
              tabIndex={isActive ? 0 : -1}
              onClick={() => select(idOrValue)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tab.label}
              {tab.count != null && <span className="tablist-count">{tab.count}</span>}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => {
        const idOrValue = tab.id ?? tab.value;
        const isActive = idOrValue === actual;
        return (
          <div
            key={idOrValue}
            id={panelId || `panel-${idOrValue}`}
            role="tabpanel"
            aria-labelledby={idOrValue}
            hidden={!isActive}
          >
            {tab.content}
          </div>
        );
      })}
    </div>
  );
}
