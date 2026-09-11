import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SearchX } from 'lucide-react';
import { capabilityClient, logger } from '@lark-apaas/client-toolkit';
import { mapVehicleRecord, getTextValue, type IVehicleRecord } from '@/data/vehicle';

interface CandidateItem {
  id: string;
  vicLicense: string;
  make: string;
  model: string;
  rawRecord: { id: string; record: Record<string, unknown> };
}

interface SearchBarSectionProps {
  onVehicleSelect: (vehicle: IVehicleRecord) => void;
  onLoadingChange: (loading: boolean) => void;
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const VEHICLE_PLUGIN_ID = 'vehicle_list_draft_readonly_query_3';

export default function SearchBarSection({
  onVehicleSelect,
  onLoadingChange,
  keyword,
  onKeywordChange,
  containerRef,
}: SearchBarSectionProps) {
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchVehicles = useCallback(async (query: string) => {
    if (query.trim().length < 1) {
      setCandidates([]);
      setShowDropdown(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    onLoadingChange(true);
    try {
      const result = await capabilityClient.load(VEHICLE_PLUGIN_ID).call<{
        hasMore: boolean;
        records: Array<{ id: string; record: Record<string, unknown> }>;
      }>('searchRecords', {
        filter: {
          conjunction: 'and',
          conditions: [
            { fieldName: 'VicLicense', operator: 'contains', value: [query.trim()] },
          ],
        },
        fieldNames: [
          'VicLicense', 'Make', 'Model', 'Status', 'Colour',
          'Veh. Class', 'Fuel type', 'Company', 'Department',
          'Section', 'Transport Coordinator', 'Parking Location',
        ],
        pageSize: 20,
      });

      const items: CandidateItem[] = (result.records ?? [])
        .map((r) => ({
          id: r.id,
          vicLicense: getTextValue(r.record['VicLicense']),
          make: getTextValue(r.record['Make']),
          model: getTextValue(r.record['Model']),
          rawRecord: r,
        }))
        .filter((item) =>
          item.vicLicense.toLowerCase().startsWith(query.trim().toLowerCase()),
        );

      setCandidates(items);
      setShowDropdown(true);
      setHasSearched(true);
    } catch (err) {
      logger.error('Vehicle search failed:', String(err));
      setCandidates([]);
      setShowDropdown(true);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
      onLoadingChange(false);
    }
  }, [onLoadingChange]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (keyword.trim().length < 1) {
      setCandidates([]);
      setShowDropdown(false);
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      searchVehicles(keyword);
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [keyword, searchVehicles]);

  const handleSelect = (item: CandidateItem) => {
    onKeywordChange(item.vicLicense);
    setShowDropdown(false);
    const vehicle = mapVehicleRecord(item.rawRecord);
    onVehicleSelect(vehicle);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [containerRef]);

  return (
    <AnimatePresence>
      {showDropdown && keyword.trim().length >= 1 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          {candidates.length > 0 ? (
            <ul className="max-h-72 overflow-y-auto py-1">
              {candidates.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover-elevate"
                    onClick={() => handleSelect(item)}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Search className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {item.vicLicense}
                      </div>
                      {(item.make || item.model) && (
                        <div className="truncate text-xs text-muted-foreground">
                          {[item.make, item.model].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : hasSearched && !isSearching ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <SearchX className="size-8 text-muted-foreground/50" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">No vehicle found</p>
                  <p className="text-xs text-muted-foreground">
                    Check the plate number or contact the Transport Team
                  </p>
                </div>
            </div>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}