import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { getTextValue } from '@/data/vehicle';
import { Sensitive } from '@/components/Redacted';

interface FieldGroup {
  title: string;
  fields: { key: string; label: string }[];
}

const FIELD_GROUPS: FieldGroup[] = [
  {
    title: 'Registration',
    fields: [
      { key: 'Reg. Date', label: 'Reg. Date' },
      { key: 'Licence Expiry Date', label: 'Licence Expiry' },
      { key: 'Sold Date', label: 'Sold Date' },
      { key: 'Chassis No.', label: 'Chassis No.' },
      { key: 'Engine No.', label: 'Engine No.' },
      { key: 'Gov Type Approval No.', label: 'Gov Type Approval No.' },
      { key: 'China Veh. Reg.', label: 'China Veh. Reg.' },
      { key: 'Veh. Class (Gov)', label: 'Veh. Class (Gov)' },
      { key: 'Fleet Number', label: 'Fleet Number' },
      { key: 'HK Boarder Control', label: 'HK Border Control' },
      { key: 'Emission Standard', label: 'Emission Standard' },
      { key: 'Trans.Type', label: 'Transmission Type' },
      {
        key: 'Engine Cap. (CC) | Power Rated (kW)',
        label: 'Engine Cap. (CC) | Power Rated (kW)',
      },
      { key: 'Gross Veh Wt. (Tons)', label: 'Gross Veh Wt. (Tons)' },
      { key: 'Unladen Wt. (Tons)', label: 'Unladen Wt. (Tons)' },
      { key: 'No. of Passengers', label: 'No. of Passengers' },
    ],
  },
  {
    title: 'Financial',
    fields: [
      { key: 'Purchase Price', label: 'Purchase Price' },
      { key: 'Licence Fee', label: 'Licence Fee' },
      { key: 'Depreciation Cost Center', label: 'Depreciation Cost Center' },
      { key: 'Operation Cost Centre', label: 'Operation Cost Centre' },
      { key: 'Exempt from UI Calulation', label: 'Exempt from UI Calculation' },
    ],
  },
  {
    title: 'Equipment',
    fields: [
      { key: 'Camera', label: 'Camera' },
      { key: 'GPS', label: 'GPS' },
      { key: 'GPS Company', label: 'GPS Provider' },
      { key: 'ADAS Installed', label: 'ADAS Installed' },
      { key: 'Windscreen net', label: 'Windscreen Net' },
      { key: 'Front Cam Installation Date', label: 'Front Cam Install Date' },
      { key: 'Cam model & status', label: 'Cam Model & Status' },
      {
        key: 'New front windscreen net progress',
        label: 'New Front Windscreen Net Progress',
      },
      { key: 'Count type (Cam & Net)', label: 'Count Type (Cam & Net)' },
      { key: 'Special Tools | GOV Licenses', label: 'Special Tools | GOV Licenses' },
    ],
  },
  {
    title: 'Other',
    fields: [
      { key: 'Replacement Plan', label: 'Replacement Plan' },
      { key: 'Veh. Replaced', label: 'Veh. Replaced' },
      { key: 'Draft - Transport Coordinator', label: 'Draft — Transport Coordinator' },
      { key: 'Remark on change (with date)', label: 'Change Remark (with Date)' },
    ],
  },
];

function InfoRow({ label, value }: { label: string; value: string | ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="flex-1 min-w-0 break-words text-sm font-medium text-foreground">
        {typeof value === 'string' ? <Sensitive value={value} fallback="—" /> : value}
      </span>
    </div>
  );
}

interface VehicleDetailCollapsibleProps {
  extraFields: Record<string, unknown>;
}

export default function VehicleDetailCollapsible({
  extraFields,
}: VehicleDetailCollapsibleProps) {
  const [open, setOpen] = useState(false);

  const groupsWithData = FIELD_GROUPS.map((group) => ({
    title: group.title,
    fields: group.fields
      .map((f) => ({ label: f.label, value: getTextValue(extraFields[f.key]) }))
      .filter((f) => f.value !== ''),
  })).filter((g) => g.fields.length > 0);

  if (groupsWithData.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="rounded-lg border border-border/50 bg-card shadow-sm">
          <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-accent/40 transition-colors">
            <div className="flex items-center gap-2.5">
              <FileText className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                 Full Details
              </span>
            </div>
            <motion.div
              animate={{ rotate: open ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="size-4 text-muted-foreground" />
            </motion.div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  key="content"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <Separator />
                  <div className="px-6 py-5 space-y-6">
                    {groupsWithData.map((group, idx) => (
                      <div key={group.title} className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.title}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                          {group.fields.map((f) => (
                            <InfoRow
                              key={f.label}
                              label={f.label}
                              value={f.value}
                            />
                          ))}
                        </div>
                        {idx < groupsWithData.length - 1 && (
                          <Separator className="mt-3" />
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </motion.div>
  );
}