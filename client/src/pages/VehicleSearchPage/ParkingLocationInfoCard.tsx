import { memo } from 'react';

import type { ParkingLocationDetail } from '@shared/api.interface';
import { getParkingValueLabel } from '@/data/labels';
import { Sensitive, isRedactedValue } from '@/components/Redacted';

interface ParkingLocationInfoCardProps {
  detail: ParkingLocationDetail;
}

function isMutedValue(text: string): boolean {
  return text === 'None' || text === 'Not confirmed';
}

function renderHeightLimit(detail: ParkingLocationDetail): string {
  const status = detail.heightLimitStatus;
  if (status === '有限高') {
    return detail.heightLimitMeters != null
      ? `Height limit ${detail.heightLimitMeters.toFixed(1)} m`
      : 'Height limit';
  }
  return getParkingValueLabel(status);
}

function FieldItem({ label, text, subText }: {
  label: string;
  text: string;
  subText?: string | null;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`text-base break-words ${
          isMutedValue(text) ? 'text-muted-foreground' : 'text-foreground'
        }`}
      >
        <Sensitive value={text} />
      </p>
      {subText && (
        <p className="text-xs text-muted-foreground">{subText}</p>
      )}
    </div>
  );
}

export default memo(function ParkingLocationInfoCard({ detail }: ParkingLocationInfoCardProps) {
  const showChargingType =
    detail.chargingEquipmentType != null &&
    detail.chargingEquipment != null &&
    detail.chargingEquipment !== '無' &&
    detail.chargingEquipment !== '未確認';

  const allowedTypes = detail.allowedVehicleTypes.length > 0
    ? detail.allowedVehicleTypes.map((t: string) => getParkingValueLabel(t)).join(', ')
    : getParkingValueLabel(null);

  const fields: Array<{ label: string; text: string; subText?: string | null }> = [
    { label: 'Address', text: isRedactedValue(detail.address) ? String(detail.address) : getParkingValueLabel(detail.address) },
    { label: 'Height Limit', text: renderHeightLimit(detail) },
    { label: 'Car Lift', text: getParkingValueLabel(detail.carLift) },
    { label: 'Parking Stack System', text: getParkingValueLabel(detail.parkingRack) },
    { label: 'Allowed Vehicle Types', text: allowedTypes },
    {
      label: 'EV Charging',
      text: getParkingValueLabel(detail.chargingEquipment),
      subText: showChargingType
        ? `Charger type: ${getParkingValueLabel(detail.chargingEquipmentType)}`
        : null,
    },
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm p-6 md:p-8">
      <h2 className="text-[18px] font-semibold text-foreground mb-6 break-words">{detail.name}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
        {fields.map((field) => (
          <FieldItem
            key={field.label}
            label={field.label}
            text={field.text}
            subText={field.subText}
          />
        ))}
      </div>
    </div>
  );
});
