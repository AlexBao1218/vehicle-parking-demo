import { useState, useCallback, useEffect, useRef, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search, Loader2 } from 'lucide-react';
import { capabilityClient, logger, scopedStorage } from '@lark-apaas/client-toolkit';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdmin } from '@/contexts/AdminContext';
import * as approvalApi from '@/api/approval';
import type { VehicleDetailResponse } from '@shared/api.interface';

import SearchBarSection from './SearchBarSection';
import VehicleResultCard from './VehicleResultCard';
import VehicleDetailCollapsible from './VehicleDetailCollapsible';
import ImageLightbox from './ImageLightbox';
import ParkingSearchSection from './ParkingSearchSection';
import { mapParkingLocation, mapVehicleRecord, getTextValue, type IVehicleRecord, type IParkingLocation } from '@/data/vehicle';

const PARKING_PLUGIN_ID = 'parking_location_map_readonly_query_3';
const VEHICLE_PLUGIN_ID = 'vehicle_list_draft_readonly_query_3';
const STORAGE_KEY_VEHICLE_ID = '__global_vpi_selectedVehicleId';

type SearchMode = 'license' | 'parking';

export default function VehicleSearchPage() {
  const [searchMode, setSearchMode] = useState<SearchMode>('license');
  const [selectedVehicle, setSelectedVehicle] = useState<IVehicleRecord | null>(null);
  const [parkingLocation, setParkingLocation] = useState<IParkingLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resultLoading, setResultLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [vehicleDetail, setVehicleDetail] = useState<VehicleDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { isAdmin, viewAsUser } = useAdmin();
  const showDetail = isAdmin && !viewAsUser;

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchKeyword(e.target.value);
  };

  /** Fuzzy-match parking location by vehicle Parking Location name */
  const fetchParkingLocation = useCallback(async (parkingLocationName: string) => {
    if (!parkingLocationName) {
      setParkingLocation({ name: '', diagramUrls: [] });
      return;
    }
    try {
      const result = await capabilityClient.load(PARKING_PLUGIN_ID).call<{
        records: Array<{ id: string; record: Record<string, unknown> }>;
        hasMore: boolean;
        total: number;
      }>('searchRecords', {
        filter: {
          conjunction: 'and',
          conditions: [{ fieldName: 'Location', operator: 'contains', value: [parkingLocationName] }],
        },
        fieldNames: ['Location', 'Diagram'],
        pageSize: 5,
      });

      const match = result.records?.[0];
      if (match) {
        const parking = mapParkingLocation(match);
        setParkingLocation(parking);
      } else {
        setParkingLocation({ name: '', diagramUrls: [] });
      }
    } catch (err) {
      logger.error('Fetch parking location failed:', String(err));
      setParkingLocation({ name: '', diagramUrls: [] });
    }
  }, []);

  const handleVehicleSelect = useCallback(async (vehicle: IVehicleRecord) => {
    setSelectedVehicle(vehicle);
    setShowResult(true);
    setResultLoading(true);
    setError(null);
    setParkingLocation(null);
    setVehicleDetail(null);

    scopedStorage.setItem(STORAGE_KEY_VEHICLE_ID, vehicle.id);

    try {
      await fetchParkingLocation(vehicle.parkingLocationName);
    } catch (err) {
      logger.error('Load parking data failed:', String(err));
      setError('Failed to load parking data. Please try again.');
    } finally {
      setResultLoading(false);
    }

    // Admin: fetch full vehicle detail
    if (isAdmin && !viewAsUser) {
      setDetailLoading(true);
      try {
        const res = await approvalApi.getVehicleDetail(vehicle.id);
        if (res.success && res.data) {
          setVehicleDetail(res.data);
        }
      } catch (err) {
        logger.error('Load vehicle detail failed:', String(err));
      } finally {
        setDetailLoading(false);
      }
    }
  }, [fetchParkingLocation, isAdmin]);

  // Restore cached vehicle on page load
  useEffect(() => {
    const cachedId = scopedStorage.getItem(STORAGE_KEY_VEHICLE_ID);
    if (!cachedId) return;

    let cancelled = false;
    (async () => {
      try {
        const result = await capabilityClient.load(VEHICLE_PLUGIN_ID).call<{
          record?: Record<string, unknown>;
        }>('getRecord', { recordID: cachedId });
        if (cancelled || !result.record) return;
        const vehicle = mapVehicleRecord({ id: cachedId, record: result.record });
        setSearchKeyword(vehicle.vicLicense);
        handleVehicleSelect(vehicle);
      } catch (err) {
        logger.error('Restore cached vehicle failed:', String(err));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = useCallback(() => {
    if (selectedVehicle) {
      handleVehicleSelect(selectedVehicle);
    }
  }, [selectedVehicle, handleVehicleSelect]);

  /** Parking mode: click a vehicle row → switch to plate mode and show full result card */
  const handleParkedVehicleClick = useCallback(async (vehicleId: string, vicLicense: string) => {
    setSearchMode('license');
    setSearchKeyword(vicLicense);
    try {
      const result = await capabilityClient.load(VEHICLE_PLUGIN_ID).call<{
        record?: Record<string, unknown>;
      }>('getRecord', { recordID: vehicleId });
      if (!result.record) return;
      const vehicle = mapVehicleRecord({ id: vehicleId, record: result.record });
      handleVehicleSelect(vehicle);
    } catch (err) {
      logger.error('Open parked vehicle failed:', String(err));
      setError('Failed to load vehicle data. Please try again.');
      setShowResult(true);
    }
  }, [handleVehicleSelect]);

  const handleImageClick = useCallback((url: string) => {
    setLightboxUrl(url);
    setLightboxOpen(true);
  }, []);

  const handleCloseLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as SearchMode)}>
            <TabsList className="h-11 w-full max-w-xs mx-auto rounded-xl p-1">
              <TabsTrigger value="license" className="text-sm">Search by Plate</TabsTrigger>
              <TabsTrigger value="parking" className="text-sm">Search by Location</TabsTrigger>
            </TabsList>
          </Tabs>

          {searchMode === 'license' ? (
          <div ref={searchContainerRef} className="relative z-20">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground z-10" />
            <Input
              type="text"
              value={searchKeyword}
              onChange={handleSearchChange}
              placeholder="Search by plate number"
              className="h-14 rounded-xl bg-card pl-12 pr-12 text-base shadow-sm border-border/60 focus-visible:ring-primary/30 w-full"
            />
            {isLoading && (
              <Loader2 className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
            <SearchBarSection
              onVehicleSelect={handleVehicleSelect}
              onLoadingChange={setIsLoading}
              keyword={searchKeyword}
              onKeywordChange={setSearchKeyword}
              containerRef={searchContainerRef}
              selectedLicense={selectedVehicle?.vicLicense}
            />
          </div>
          ) : (
            <ParkingSearchSection
              onVehicleClick={handleParkedVehicleClick}
              onImageClick={handleImageClick}
            />
          )}

          {searchMode === 'license' && (
          <AnimatePresence mode="wait">
            {(showResult || resultLoading) && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="space-y-4">
                  <VehicleResultCard
                    vehicle={selectedVehicle}
                    parking={parkingLocation}
                    loading={resultLoading}
                    error={error}
                    onRetry={handleRetry}
                    onImageClick={handleImageClick}
                  />

                  {showDetail && !resultLoading && !error && selectedVehicle && (
                    <>
                      {detailLoading && (
                        <div className="rounded-lg border border-border/50 bg-card shadow-sm px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="size-4 rounded bg-accent animate-pulse" />
                            <div className="h-4 w-24 rounded bg-accent animate-pulse" />
                          </div>
                        </div>
                      )}
                      {!detailLoading && vehicleDetail?.extraFields && (
                        <VehicleDetailCollapsible
                          extraFields={vehicleDetail.extraFields as Record<string, unknown>}
                        />
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {!showResult && !resultLoading && !isLoading && searchKeyword.trim().length === 0 && (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <MapPin className="size-8 text-muted-foreground/60" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Enter a plate number to look up a vehicle
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          )}
        </motion.div>
      </div>

      <ImageLightbox
        open={lightboxOpen}
        imageUrl={lightboxUrl}
        onClose={handleCloseLightbox}
      />
    </>
  );
}