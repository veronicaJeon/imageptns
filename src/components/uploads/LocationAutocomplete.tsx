"use client";

import { useEffect, useId, useRef, useState } from "react";

interface LocationSuggestion {
  code: string;
  name: string;
  level: "sido" | "sigungu" | "eup_myeon_dong" | "ri";
}

interface LocationAutocompleteProps {
  lang: "ko" | "en";
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

const COPY = {
  ko: {
    label: "촬영장소 검색",
    loading: "행정구역을 검색하고 있어요…",
    empty: "일치하는 행정구역이 없습니다. 직접 입력할 수 있습니다.",
    hint: "2글자 이상 입력하면 시·도/시·군·구/읍·면·동/리 단위로 추천합니다.",
  },
  en: {
    label: "Search shooting location",
    loading: "Searching administrative areas…",
    empty: "No matching administrative area. You can keep your manual entry.",
    hint: "Enter at least 2 characters for province, city, district, town, or village suggestions.",
  },
} as const;

export function LocationAutocomplete({ lang, value, placeholder, onChange }: LocationAutocompleteProps) {
  const copy = COPY[lang];
  const listId = useId();
  const requestIdRef = useRef(0);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const query = value.trim();
    if (!focused || query.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/locations/suggest?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json() as { suggestions?: LocationSuggestion[] };
        if (requestId !== requestIdRef.current) return;
        setSuggestions(response.ok && Array.isArray(body.suggestions) ? body.suggestions : []);
        setActiveIndex(-1);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (requestId === requestIdRef.current) setSuggestions([]);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [focused, value]);

  const showPanel = focused && value.trim().length >= 2;

  function selectSuggestion(suggestion: LocationSuggestion) {
    onChange(suggestion.name);
    setSuggestions([]);
    setFocused(false);
    setActiveIndex(-1);
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="text"
        role="combobox"
        aria-label={copy.label}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showPanel}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (!showPanel || suggestions.length === 0) {
            if (event.key === "Escape") setFocused(false);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            selectSuggestion(suggestions[activeIndex]);
          } else if (event.key === "Escape") {
            setFocused(false);
          }
        }}
        placeholder={placeholder}
        className="h-12 w-full rounded-lg bg-surface-container-lowest px-4 pr-10 text-sm text-on-surface outline-none ring-1 ring-outline-variant transition-all placeholder:text-outline focus:ring-2 focus:ring-primary"
      />
      <span className="material-symbols-outlined pointer-events-none absolute right-3 top-3 text-xl text-outline">location_on</span>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-outline-variant/50 bg-surface-container-lowest shadow-xl">
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.code} id={`${listId}-${index}`} role="option" aria-selected={activeIndex === index}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectSuggestion(suggestion);
                  }}
                  className={`flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm transition-colors ${activeIndex === index ? "bg-primary/10 text-primary" : "text-on-surface hover:bg-surface-container-low"}`}
                >
                  <span className="material-symbols-outlined mt-0.5 text-base text-outline">place</span>
                  <span>{suggestion.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="border-t border-outline-variant/30 px-4 py-2 text-[11px] leading-relaxed text-outline">
            {loading ? copy.loading : suggestions.length === 0 ? copy.empty : copy.hint}
          </p>
        </div>
      )}
    </div>
  );
}
