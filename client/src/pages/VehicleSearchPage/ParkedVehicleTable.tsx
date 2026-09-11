import { memo, useMemo, useState, type ChangeEvent } from 'react';
import { Car, Search } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ParkedVehicleSummary } from '@shared/api.interface';

interface ParkedVehicleTableProps {
  vehicles: ParkedVehicleSummary[];
  loading: boolean;
  onVehicleClick: (vehicle: ParkedVehicleSummary) => void;
}

const ALL_DEPARTMENTS = '__all__';

export default memo(function ParkedVehicleTable({
  vehicles,
  loading,
  onVehicleClick,
}: ParkedVehicleTableProps) {
  const [plateQuery, setPlateQuery] = useState('');
  const [department, setDepartment] = useState(ALL_DEPARTMENTS);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const v of vehicles) {
      if (v.department) set.add(v.department);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [vehicles]);

  const filtered = useMemo(() => {
    const q = plateQuery.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (q && !v.vicLicense.toLowerCase().includes(q)) return false;
      if (department !== ALL_DEPARTMENTS && v.department !== department) return false;
      return true;
    });
  }, [vehicles, plateQuery, department]);

  const handlePlateChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPlateQuery(e.target.value);
  };

  const isFiltering = plateQuery.trim().length > 0 || department !== ALL_DEPARTMENTS;

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="px-6 pt-5 pb-4 space-y-4">
        <h3 className="text-base font-medium text-foreground/90">
          Vehicles ({loading ? '…' : vehicles.length})
        </h3>
        {!loading && vehicles.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={plateQuery}
                onChange={handlePlateChange}
                placeholder="Search plate…"
                className="h-9 rounded-lg bg-background pl-9 pr-3 text-sm border-border/60 focus-visible:ring-primary/30"
              />
            </div>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="h-9 w-full sm:w-[200px] rounded-lg bg-background text-sm border-border/60 focus:ring-primary/30">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="px-6 pb-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 rounded-md bg-accent animate-pulse" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="size-14 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Car className="size-7 text-muted-foreground/60" />
          </div>
          <p className="text-sm text-muted-foreground">No vehicles are registered at this location.</p>
        </div>
      ) : (
        <>
          <div className="max-h-[400px] overflow-y-auto border-t border-border/40">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[110px]">Plate</TableHead>
                  <TableHead className="w-[180px]">Make &amp; Model</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="w-[150px]">Section</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                      No vehicles match the filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((vehicle) => (
                    <TableRow
                      key={vehicle.id}
                      className="cursor-pointer"
                      onClick={() => onVehicleClick(vehicle)}
                    >
                      <TableCell className="font-medium">{vehicle.vicLicense}</TableCell>
                      <TableCell className="whitespace-normal break-words">
                        {[vehicle.make, vehicle.model].filter(Boolean).join(' ')}
                      </TableCell>
                      <TableCell className="max-w-[280px] text-muted-foreground">
                        {vehicle.department ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate">{vehicle.department}</span>
                            </TooltipTrigger>
                            <TooltipContent>{vehicle.department}</TooltipContent>
                          </Tooltip>
                        ) : (
                          'None'
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words text-muted-foreground">
                        {vehicle.section}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="px-6 py-3 border-t border-border/40">
            <p className="text-xs text-muted-foreground">
              {isFiltering
                ? `Showing ${filtered.length} of ${vehicles.length}`
                : `Showing ${vehicles.length} of ${vehicles.length}`}
            </p>
          </div>
        </>
      )}
    </div>
  );
});
