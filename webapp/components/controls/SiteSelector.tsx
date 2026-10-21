import type { Site } from "@/types/parking";

interface SiteSelectorProps {
  sites: Site[];
  value: number;
  onChange: (siteId: number) => void;
}

export default function SiteSelector({
  sites,
  value,
  onChange,
}: SiteSelectorProps) {
  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
        Site
      </span>

      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
      >
        {sites.map((site) => (
          <option key={site.site_id} value={site.site_id}>
            {site.site_name}
          </option>
        ))}
      </select>
    </label>
  );
}
