import { memo } from 'react';
import { MapPin, Maximize2 } from 'lucide-react';

import { Image } from '@/components/ui/image';

interface ParkingImageGridProps {
  title: string;
  urls: string[];
  locationName: string;
  /** If emptyText is provided, 0 images renders a placeholder; otherwise the whole block is hidden. */
  emptyText?: string;
  onImageClick: (url: string) => void;
}

export default memo(function ParkingImageGrid({
  title,
  urls,
  locationName,
  emptyText,
  onImageClick,
}: ParkingImageGridProps) {
  if (urls.length === 0 && !emptyText) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-medium text-foreground/90">{title}</h3>

      {urls.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 py-12">
          <MapPin className="size-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        </div>
      ) : (
        <div
          className={
            urls.length === 1
              ? 'grid grid-cols-1 gap-4'
              : 'grid grid-cols-1 sm:grid-cols-2 gap-4'
          }
        >
          {urls.map((url, idx) => (
            <button
              key={`${url}-${idx}`}
              type="button"
              className="group relative overflow-hidden rounded-xl border border-border/60 bg-muted/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => onImageClick(url)}
               aria-label="Click to enlarge"
            >
              <Image
                src={url}
                alt={`${locationName || 'parking lot'} — ${title} ${idx + 1}`}
                className="w-full h-auto object-contain max-h-[320px] transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors duration-300" />
              <div className="absolute top-3 right-3 size-8 rounded-lg bg-background/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Maximize2 className="size-4 text-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
