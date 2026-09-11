import { memo, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Building2, MapPin, AlertCircle } from 'lucide-react';
import { type IVehicleRecord, type IParkingLocation } from '@/data/vehicle';
import ParkingMapSection from './ParkingMapSection';

interface VehicleResultCardProps {
  vehicle: IVehicleRecord | null;
  parking: IParkingLocation | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onImageClick: (url: string) => void;
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status.startsWith('Active');
  const isSold = status === 'Sold';

  let className = 'shrink-0';
  if (isActive) {
    className += ' bg-success text-success-foreground border-success/20';
  } else if (isSold) {
    className += ' bg-muted text-muted-foreground border-muted';
  } else {
    className += ' bg-warning/15 text-warning border-warning/20';
  }

  return (
    <Badge variant="outline" className={className}>
      {status || 'None'}
    </Badge>
  );
}

function InfoRow({ label, value }: { label: string; value: string | ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">
        {value || 'None'}
      </span>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Building2; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-primary" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function VehicleResultCardContent({ vehicle, parking, onImageClick }: {
  vehicle: IVehicleRecord;
  parking: IParkingLocation | null;
  onImageClick: (url: string) => void;
}) {
  const vehicleFields = [
    { label: 'Make', value: vehicle.make },
    { label: 'Model', value: vehicle.model },
    { label: 'Colour', value: vehicle.colour },
    { label: 'Vehicle Class', value: vehicle.vehClass },
    { label: 'Fuel Type', value: vehicle.fuelType },
  ];

  const companyValue: string | ReactNode = vehicle.company ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block truncate">{vehicle.company}</span>
      </TooltipTrigger>
      <TooltipContent>{vehicle.company}</TooltipContent>
    </Tooltip>
  ) : (
    vehicle.company
  );

  const ownershipFields = [
    { label: 'Company', value: companyValue },
    { label: 'Department', value: vehicle.department },
    { label: 'Transport Coordinator', value: vehicle.transportCoordinator },
    { label: 'Section', value: vehicle.section },
  ];

  return (
    <Card className="w-full shadow-sm border-border/50">
      <CardContent className="p-6 md:p-8 space-y-6">
        {/* ① Vehicle info */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-xl md:text-2xl font-bold text-foreground truncate tracking-tight">
              {vehicle.vicLicense}
            </h2>
            <StatusBadge status={vehicle.status} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {vehicleFields.map(f => (
              <InfoRow key={f.label} label={f.label} value={f.value} />
            ))}
          </div>
        </div>

        <Separator />

        {/* ② Ownership */}
        <div className="space-y-4">
          <SectionTitle icon={Building2} title="Ownership" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {ownershipFields.map(f => (
              <InfoRow key={f.label} label={f.label} value={f.value} />
            ))}
          </div>
        </div>

        <Separator />

        {/* ③ Parking location */}
        <div className="space-y-4">
          <SectionTitle icon={MapPin} title="Parking Location" />
          <ParkingMapSection parkingLocation={parking} onImageClick={onImageClick} />
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(function VehicleResultCard({
  vehicle, parking, loading, error, onRetry, onImageClick,
}: VehicleResultCardProps) {
  if (loading) {
    return (
      <Card className="w-full shadow-sm border-border/50">
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-6 w-16" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full shadow-sm border-border/50">
        <CardContent className="p-8 md:p-12 text-center space-y-4">
          <div className="inline-flex size-12 rounded-full bg-destructive/10 items-center justify-center">
            <AlertCircle className="size-5 text-destructive" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Failed to load data</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!vehicle) return null;

  return (
    <VehicleResultCardContent
      vehicle={vehicle}
      parking={parking}
      onImageClick={onImageClick}
    />
  );
});