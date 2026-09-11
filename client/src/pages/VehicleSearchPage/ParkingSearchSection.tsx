import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Loader2, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { logger } from '@lark-apaas/client-toolkit/logger';
import * as parkingApi from '@/api/parking-locations';
import type {
  ParkingLocationSummary,
  ParkingLocationDetail,
  ParkedVehicleSummary,
} from '@shared/api.interface';

import ParkingLocationInfoCard from './ParkingLocationInfoCard';
import ParkingImageGrid from './ParkingImageGrid';
import ParkedVehicleTable from './ParkedVehicleTable';

interface ParkingSearchSectionProps {
  onVehicleClick: (vehicleId: string, vicLicense: string) => void;
  onImageClick: (url: string) => void;
}

export default function ParkingSearchSection({
  onVehicleClick,
  onImageClick,
}: ParkingSearchSectionProps) {
  const [locations, setLocations] = useState<ParkingLocationSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ParkingLocationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [vehicles, setVehicles] = useState<ParkedVehicleSummary[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);
  const requestSeqRef = useRef(0);

  const loadLocations = useCallback(async () => {
    setListLoading(true);
    setListError(false);
    try {
      const res = await parkingApi.listParkingLocations();
      setLocations(res.data.items);
    } catch (err) {
      logger.error('Load parking locations failed:', String(err));
      setListError(true);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const loadLocationContent = useCallback(async (id: string) => {
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    setSelectedId(id);
    setDetail(null);
    setVehicles([]);
    setDetailLoading(true);
    setVehiclesLoading(true);
    setContentError(null);
    try {
      const [detailRes, vehiclesRes] = await Promise.all([
        parkingApi.getParkingLocationDetail(id),
        parkingApi.listParkedVehicles(id),
      ]);
      if (requestSeqRef.current !== seq) return;
      setDetail(detailRes.data);
      setVehicles(vehiclesRes.data.items);
    } catch (err) {
      if (requestSeqRef.current !== seq) return;
      logger.error('Load parking location content failed:', String(err));
      setContentError('Failed to load data. Please try again.');
    } finally {
      if (requestSeqRef.current === seq) {
        setDetailLoading(false);
        setVehiclesLoading(false);
      }
    }
  }, []);

  const handleQueryChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowDropdown(true);
  };

  const handleSelect = useCallback((location: ParkingLocationSummary) => {
    setQuery(location.name);
    setShowDropdown(false);
    loadLocationContent(location.id);
  }, [loadLocationContent]);

  const handleContentRetry = useCallback(() => {
    if (selectedId) loadLocationContent(selectedId);
  }, [selectedId, loadLocationContent]);

  const handleVehicleRowClick = useCallback(
    (vehicle: ParkedVehicleSummary) => {
      onVehicleClick(vehicle.id, vehicle.vicLicense);
    },
    [onVehicleClick],
  );

  const trimmedQuery = query.trim().toLowerCase();
  const filteredLocations = trimmedQuery
    ? locations.filter((loc) => loc.name.toLowerCase().includes(trimmedQuery))
    : locations;

  return (
    <div className="space-y-6">
      <div ref={containerRef} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground z-10" />
        <Input
          type="text"
          value={query}
          onChange={handleQueryChange}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search or select a parking lot"
          className="h-14 rounded-xl bg-card pl-12 pr-12 text-base shadow-sm border-border/60 focus-visible:ring-primary/30 w-full"
        />
        {listLoading && (
          <Loader2 className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {showDropdown && !listLoading && (
          <div className="absolute z-20 mt-2 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden">
            {filteredLocations.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No matching parking lot. Check your input or try another keyword.
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {filteredLocations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-accent ${
                      loc.id === selectedId ? 'bg-accent text-accent-foreground' : 'text-foreground'
                    }`}
                    onClick={() => handleSelect(loc)}
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {listError && !listLoading && (
        <div className="rounded-xl border border-border/60 bg-card shadow-sm px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground mb-4">Failed to load parking lot list. Please try again.</p>
           <Button variant="outline" size="sm" onClick={loadLocations}>
             <RefreshCw className="size-4" />
             Reload
           </Button>
        </div>
      )}

      {!listError && !selectedId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <MapPin className="size-8 text-muted-foreground/60" />
          </div>
           <p className="text-muted-foreground text-sm">Select a parking lot to view details</p>
        </motion.div>
      )}

      {selectedId && (
        <AnimatePresence mode="wait">
          {contentError ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-xl border border-border/60 bg-card shadow-sm px-6 py-10 text-center"
            >
              <p className="text-sm text-muted-foreground mb-4">{contentError}</p>
                <Button variant="outline" size="sm" onClick={handleContentRetry}>
                  <RefreshCw className="size-4" />
                  Reload
                </Button>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {detailLoading ? (
                <div className="rounded-xl border border-border/60 bg-card shadow-sm p-6 md:p-8 space-y-5">
                  <div className="h-8 w-48 rounded bg-accent animate-pulse" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 w-16 rounded bg-accent animate-pulse" />
                        <div className="h-5 w-32 rounded bg-accent animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                detail && <ParkingLocationInfoCard detail={detail} />
              )}

              {!detailLoading && detail && (
                <div className="rounded-xl border border-border/60 bg-card shadow-sm p-6 md:p-8 space-y-8">
                   <ParkingImageGrid
                     title="Parking Map"
                     urls={detail.diagramUrls}
                     locationName={detail.name}
                     emptyText="No parking map available for this location"
                     onImageClick={onImageClick}
                   />
                   <ParkingImageGrid
                     title="Street View"
                     urls={detail.streetViewUrls}
                     locationName={detail.name}
                     onImageClick={onImageClick}
                   />
                </div>
              )}

              <ParkedVehicleTable
                vehicles={vehicles}
                loading={vehiclesLoading}
                onVehicleClick={handleVehicleRowClick}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
