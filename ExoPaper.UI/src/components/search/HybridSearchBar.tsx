import { useState } from "react";
import { Search, Brain, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import type { HybridSearchRequest, PaperSearchHit } from "../../types";
import { hybridSearch } from "../../api/papers";
import SearchResults from "./SearchResults";
import { useT } from "../../i18n/LanguageContext";

interface Props {
  onSearch?: (searchText: string, maxMass: number | null, discoveryMethod: string, take: number) => void;
  isSearchingGlobal?: boolean;
}

export default function HybridSearchBar({ onSearch, isSearchingGlobal }: Props) {
  const t = useT();
  const [searchText, setSearchText] = useState("");
  const [maxMass, setMaxMass] = useState<number | null>(null);
  const [discoveryMethod, setDiscoveryMethod] = useState("");
  const [take, setTake] = useState(10);
  const [results, setResults] = useState<PaperSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    if (onSearch) {
      onSearch(searchText.trim(), maxMass, discoveryMethod, take);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const req: HybridSearchRequest = {
        searchText: searchText.trim(),
        maxMassEarth: maxMass,
        discoveryMethod: discoveryMethod || null,
        take,
      };
      const res = await hybridSearch(req);
      setResults(res.papers);
    } catch (e) {
      console.error("Hybrid search failed:", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className={`glass rounded-xl p-1 transition-all duration-500 ${
        isSearchingGlobal 
          ? "animate-search-pulse border-[#B48EAD]" 
          : "glow-purple"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2 flex-1 px-4">
            <Brain className="h-5 w-5 text-accent-purple shrink-0" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("search.placeholder")}
              className="w-full bg-transparent py-3 text-sm text-text-primary placeholder:text-text-muted outline-none"
            />
          </div>

          <div className="flex items-center gap-2 px-2 pb-2 sm:px-0 sm:pb-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-accent-purple hover:bg-accent-purple/10 transition-all"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t("search.filters")}
              {showFilters ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            <button
              onClick={handleSearch}
              disabled={loading || !searchText.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-purple px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-purple/80 transition-all disabled:opacity-40 sm:flex-none sm:mr-1"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {t("search.button")}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="border-t border-border px-4 py-3 flex flex-wrap gap-4 animate-fade-in-up">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                {t("search.maxMass")}
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={maxMass ?? ""}
                onChange={(e) =>
                  setMaxMass(e.target.value ? parseFloat(e.target.value) : null)
                }
                placeholder="e.g. 2.0"
                className="w-28 rounded-md border border-border bg-space-800 px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent-purple transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                {t("search.discoveryMethod")}
              </label>
              <select
                value={discoveryMethod}
                onChange={(e) => setDiscoveryMethod(e.target.value)}
                className="w-40 rounded-md border border-border bg-space-800 px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent-purple transition-colors"
              >
                <option value="">{t("search.any")}</option>
                <option value="Transit">{t("method.transit")}</option>
                <option value="Radial Velocity">{t("method.radialVelocity")}</option>
                <option value="Microlensing">{t("method.microlensing")}</option>
                <option value="Direct Imaging">{t("method.directImaging")}</option>
                <option value="Transit Timing Variations">{t("method.ttv")}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                {t("search.results")}
              </label>
              <select
                value={take}
                onChange={(e) => setTake(Number(e.target.value))}
                className="w-20 rounded-md border border-border bg-space-800 px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent-purple transition-colors"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {searched && <SearchResults results={results} loading={loading} />}
    </div>
  );
}
