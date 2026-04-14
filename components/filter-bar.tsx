"use client";

import { useRouter } from "next/navigation";
import { clsx } from "clsx";

type FilterBarProps = {
  airports: { code: string; name: string }[];
  currentAirport: string;
  currentDate: string;
  currentDirection: "A" | "D";
  // Add limits
  minDate?: string;
  maxDate?: string;
};

export default function FilterBar({
  airports,
  currentAirport,
  currentDate,
  currentDirection,
  minDate, // e.g. "2024-01-01"
  maxDate, // e.g. "2024-01-03"
}: FilterBarProps) {
  const router = useRouter();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams();

    // Preserve existing logic
    params.set("airport", key === "airport" ? value : currentAirport);
    params.set("date", key === "date" ? value : currentDate);
    params.set("direction", key === "direction" ? value : currentDirection);

    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 items-end">
      {/* Airport Selector (Unchanged) */}
      <div className="flex-1 w-full">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Airport
        </label>
        <select
          value={currentAirport}
          onChange={(e) => updateFilter("airport", e.target.value)}
          className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          {airports.map((airport) => (
            <option key={airport.code} value={airport.code}>
              {airport.name} ({airport.code})
            </option>
          ))}
        </select>
      </div>

      {/* Date Picker (UPDATED) */}
      <div className="flex-1 w-full">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Date
        </label>
        <input
          type="date"
          value={currentDate}
          min={minDate} // Blocks dates before this
          max={maxDate} // Blocks dates after this
          onChange={(e) => updateFilter("date", e.target.value)}
          className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Direction Toggle (Unchanged) */}
      <div className="flex-1 w-full">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Direction
        </label>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => updateFilter("direction", "D")}
            className={clsx(
              "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
              currentDirection === "D"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200",
            )}
          >
            Departures
          </button>
          <button
            onClick={() => updateFilter("direction", "A")}
            className={clsx(
              "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
              currentDirection === "A"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200",
            )}
          >
            Arrivals
          </button>
        </div>
      </div>
    </div>
  );
}
