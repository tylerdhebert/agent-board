import { useState, useRef, useEffect, useId } from "react";

interface ComboboxProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function Combobox({ options, value, onChange, placeholder, className }: ComboboxProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Keep query in sync when value changes externally
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  );

  const highlightedId = open && filtered[highlighted] !== undefined
    ? `${listboxId}-option-${highlighted}`
    : undefined;

  function select(option: string) {
    onChange(option);
    setQuery(option);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[highlighted] !== undefined) {
        select(filtered[highlighted]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery(value);
    }
  }

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [value]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={highlightedId}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="field-shell w-full px-3 py-2 text-xs font-mono"
        spellCheck={false}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-[14px] border border-[var(--accent-border)] bg-[var(--panel-bg)] shadow-lg">
          <ul id={listboxId} role="listbox" className="max-h-52 overflow-y-auto py-1">
            {filtered.map((option, i) => (
              <li
                key={i}
                id={`${listboxId}-option-${i}`}
                role="option"
                aria-selected={i === highlighted}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(option);
                }}
                className={[
                  "cursor-pointer px-3 py-2 text-xs font-mono transition-colors",
                  i === highlighted
                    ? "bg-[var(--accent-surface)] text-[var(--accent-strong)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--panel-hover)]",
                ].join(" ")}
              >
                {option}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
