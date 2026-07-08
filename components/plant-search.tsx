"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";

type PlantSearchResult = {
  id: string;
  nickname: string;
  imageUrl: string | null;
  speciesName: string;
  vaultName: string;
};

export function PlantSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlantSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      abortControllerRef.current?.abort();
      setResults([]);
      setIsOpen(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setIsOpen(true);

    const timeout = setTimeout(async () => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(`/api/plants/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal
        });

        if (!response.ok) {
          setResults([]);
          setIsSearching(false);
          return;
        }

        const payload = await response.json();
        setResults(payload.plants ?? []);
        setIsSearching(false);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
          setIsSearching(false);
        }
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  return (
    <div className="plant-search" ref={containerRef}>
      <Input
        aria-label="Search your plants"
        className="topbar-search__field"
        containerClassName="topbar-search"
        icon="search"
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => {
          if (query.trim().length >= 2) {
            setIsOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
            event.currentTarget.blur();
          }
        }}
        placeholder="Search your plants..."
        type="search"
        value={query}
      />

      {isOpen ? (
        <div className="plant-search__dropdown panel" role="listbox">
          {isSearching ? (
            <p className="plant-search__status">Looking for a plant...</p>
          ) : results.length === 0 ? (
            <p className="plant-search__status">No plants found.</p>
          ) : (
            results.map((plant) => (
              <Link
                className="plant-search__result"
                href={`/plant/${plant.id}`}
                key={plant.id}
                onClick={() => setIsOpen(false)}
              >
                <span className="plant-search__thumb">
                  {plant.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" src={plant.imageUrl} />
                  ) : (
                    <Icon name="plant" />
                  )}
                </span>
                <span className="plant-search__text">
                  <strong>{plant.nickname}</strong>
                  <span>{plant.speciesName}</span>
                </span>
                <span className="plant-search__vault">{plant.vaultName}</span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
