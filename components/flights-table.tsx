"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { FlightViewModel } from "@/app/actions";
import Link from "next/link";
import { BiInfoCircle } from "react-icons/bi";
import getFlightNotifications, { FlightInfo } from "./flight-notification";

type FlightsTableProps = {
  flights: FlightViewModel[];
  airlineMap: Record<string, string>;
  airportMap: Record<string, string>;
  direction: "A" | "D";
};

function StatusBadge({
  code,
  schedule,
  time,
  desc, // Flight Status Description (e.g., "Delayed")
  direction,
  gateCode,
  gateDesc, // Gate Status Description (e.g., "Gate Closing")
}: {
  code: string | null;
  schedule: Date;
  time: Date | null;
  desc: string | null;
  direction: "A" | "D";
  gateCode: string | null;
  gateDesc: string | null;
}) {
  const gateStyles: Record<string, string> = {
    O: "bg-green-50 text-green-700 border-green-200",
    B: "bg-green-100 text-green-800 border-green-300 animate-pulse",
    C: "bg-slate-100 text-slate-500 border-slate-200 opacity-75",
    F: "bg-orange-100 text-orange-700 border-orange-200 animate-pulse",
  };

  const gateFallbackLabels: Record<string, string> = {
    O: "Go to gate",
    B: "Boarding",
    C: "Gate closed",
    F: "Gate closing",
  };
  // 1. GATE STATUS TRUMPS FLIGHT STATUS
  // If Avinor provides a gate-specific message, show it in a "High Alert" style
  if (gateCode && code != "D" && direction == "D") {
    const gateStyleClass = gateStyles[gateCode] || "bg-gray-100";
    const gateLabel = gateDesc || gateFallbackLabels[gateCode] || gateCode;
    return (
      <span
        className={clsx(
          "inline-block px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border whitespace-nowrap",
          gateStyleClass,
        )}
      >
        {gateLabel}
      </span>
    );
  }

  // 2. FALLBACK TO NORMAL FLIGHT STATUS LOGIC
  if (!code) return null;

  let displayCode = code;

  // Hide "New Time" badge if change is less than 10 mins (your existing logic)
  if (
    displayCode === "E" &&
    (!time?.getTime() ||
      (time.getTime() - 10 * 60000 < schedule.getTime() &&
        time.getTime() + 10 * 60000 > schedule.getTime()))
  ) {
    return null;
  }

  const styles: Record<string, string> = {
    A: "bg-green-50 text-green-700 border-green-200",
    C: "bg-red-50 text-red-700 border-red-200 font-extrabold",
    D: "bg-blue-50 text-blue-700 border-blue-200",
    E: "bg-yellow-50 text-yellow-700 border-yellow-200",
    N: "bg-gray-50 text-gray-700 border-gray-200",
  };

  const fallbackLabels: Record<string, string> = {
    A: "Arrived",
    C: "Cancelled",
    D: "Departed",
    E: "New Time",
    N: "Info",
  };

  const styleClass = styles[displayCode] || "bg-gray-100";
  const label = desc || fallbackLabels[displayCode] || displayCode;

  return (
    <span
      className={clsx(
        "inline-block px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border whitespace-nowrap",
        styleClass,
      )}
    >
      {label}
      {time && displayCode === "E" && (
        <span className="ml-1">
          {time.toLocaleTimeString("no-NO", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      )}
    </span>
  );
}

export default function FlightsTable({
  flights,
  airlineMap,
  airportMap,
  direction,
}: FlightsTableProps) {
  const router = useRouter();
  const [showPastFlights, setShowPastFlights] = useState(false);
  const [flightType, setFlightType] = useState<"ALL" | "DOM" | "INT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [router]);

  const filteredFlights = flights.filter((flight) => {
    if (flightType === "DOM" && flight.dom_int !== "D") return false;
    if (flightType === "INT" && !["I", "S"].includes(flight.dom_int || ""))
      return false;

    if (!showPastFlights) {
      const statusCode = flight.status_code;
      if (direction === "D") {
        if (statusCode === "D" || statusCode === "A") return false;
      } else {
        if (statusCode === "A") return false;
      }
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const airlineName = (
        airlineMap[flight.airline || ""] ||
        flight.airline ||
        ""
      ).toLowerCase();
      const targetAirportCode = (
        direction === "D" ? flight.to_airport : flight.from_airport
      ).toLowerCase();
      const targetAirportName = (
        airportMap[
          direction === "D" ? flight.to_airport : flight.from_airport
        ] || ""
      ).toLowerCase();
      const flightId = flight.flightId.toLowerCase();

      if (
        !flightId.includes(query) &&
        !airlineName.includes(query) &&
        !targetAirportName.includes(query) &&
        !targetAirportCode.includes(query)
      ) {
        return false;
      }
    }

    return true;
  });

  if (flights.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <p className="text-gray-500 text-lg">
          No flights found for this selection.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
      {/* --- TOOLBAR --- */}
      <div className="bg-gray-50 border-b border-gray-200 px-3 sm:px-6 py-3 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-1 bg-gray-200/50 p-1 rounded-lg self-start">
            {(["ALL", "DOM", "INT"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFlightType(type)}
                className={clsx(
                  "px-3 py-1 text-xs font-bold rounded-md transition-all",
                  flightType === type
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-200",
                )}
              >
                {type === "ALL"
                  ? "All"
                  : type === "DOM"
                    ? "Domestic"
                    : "International"}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 select-none">
            <input
              type="checkbox"
              checked={showPastFlights}
              onChange={(e) => setShowPastFlights(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            Show Past Flights
          </label>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
              <th className="px-2 sm:px-6 py-4 w-px whitespace-nowrap">Time</th>
              <th className="px-2 sm:px-6 py-4 w-auto">
                {direction === "D" ? "Destination" : "Origin"}
              </th>
              <th className="hidden md:table-cell px-6 py-4 hidden sm:table-cell w-px whitespace-nowrap">
                Info
              </th>
              <th className="px-2 sm:px-6 py-4 hidden sm:table-cell w-px whitespace-nowrap">
                Flight
              </th>
              <th className="px-2 sm:px-6 py-4 w-px whitespace-nowrap text-center">
                Gate
              </th>
              <th className="px-2 sm:px-6 py-4 text-right w-px whitespace-nowrap">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredFlights.map((flight) => {
              const airlineName = flight.airline
                ? airlineMap[flight.airline] || flight.airline
                : "Unknown";

              const targetAirportCode =
                direction === "D" ? flight.to_airport : flight.from_airport;
              const targetAirportName =
                airportMap[targetAirportCode] || targetAirportCode;

              const displayTime = flight.schedule_time.toLocaleTimeString(
                "no-NO",
                { hour: "2-digit", minute: "2-digit" },
              );
              const statusTime = flight.status_time?.toLocaleTimeString(
                "no-NO",
                { hour: "2-digit", minute: "2-digit" },
              );
              const isDeparted =
                flight.status_code === "D" ||
                (direction === "D" && flight.status_code === "A");
              const isDelayed =
                (flight.status_code === "E" || flight.status_code === "N") &&
                flight.status_time?.getTime() &&
                statusTime != displayTime;

              // New Time Display Logic in Table Row
              // Only show yellow text if the delay/early is significant (>= 10 mins)
              const isSignificantChange =
                isDelayed &&
                flight.status_time &&
                (flight.status_time.getTime() - 10 * 60000 >
                  flight.schedule_time.getTime() ||
                  flight.status_time.getTime() + 10 * 60000 <
                    flight.schedule_time.getTime());

              return (
                <tr
                  key={flight.uniqueId}
                  className="hover:bg-slate-50 transition-colors group text-sm sm:text-base"
                >
                  {/* TIME */}
                  <td className="px-2 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span
                        className={clsx(
                          "font-bold tabular-nums",
                          isSignificantChange || isDeparted
                            ? "text-gray-400 line-through text-xs sm:text-sm"
                            : "text-gray-900",
                        )}
                      >
                        {displayTime}
                      </span>
                      {(isSignificantChange || isDeparted) &&
                        flight.status_time && (
                          <span
                            className={clsx(
                              "font-bold tabular-nums",
                              isSignificantChange
                                ? "text-yellow-600"
                                : "text-gray-900",
                            )}
                          >
                            {flight.status_time.toLocaleTimeString("no-NO", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                    </div>
                  </td>

                  {/* REST OF COLUMNS (Identical to before) */}
                  <td className="px-2 sm:px-6 py-3 sm:py-4">
                    <div className="flex flex-row">
                      <div className="max-w-[120px] sm:max-w-none">
                        <p className="font-semibold text-gray-900 truncate">
                          {targetAirportName}
                        </p>
                        <div className="flex gap-2 items-baseline">
                          <p className="text-xs text-gray-500 font-medium">
                            {targetAirportCode}
                          </p>
                          <p className="text-[10px] text-gray-400 sm:hidden">
                            {flight.flightId}
                          </p>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-3 py-4">
                    <div className="flex flex-wrap gap-2 mt-2">
                      {getFlightNotifications(flight, direction).map(
                        (alert, i) => {
                          const Icon = alert.icon;
                          return (
                            <div
                              key={i}
                              className={clsx(
                                "flex items-center gap-2 my-auto px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border whitespace-nowrap",
                                alert.type === "delay" &&
                                  "bg-yellow-50 text-yellow-700 border-yellow-200",
                                alert.type === "info" &&
                                  "bg-blue-50 text-blue-700 border-blue-200",
                                alert.type === "warning" &&
                                  "bg-red-50 text-red-700 border-red-200",
                              )}
                            >
                              <Icon className="w-3 h-3" />
                              <span>{alert.message}</span>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </td>
                  <td className="px-2 sm:px-6 py-3 sm:py-4 hidden sm:table-cell whitespace-nowrap">
                    <div>
                      <p className="font-medium text-gray-900">
                        {flight.flightId}
                      </p>
                      <p className="text-xs text-gray-500 truncate max-w-[150px]">
                        {airlineName}
                      </p>
                    </div>
                  </td>
                  <td className="px-2 sm:px-6 py-3 sm:py-4 text-center">
                    {flight.gate ? (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-700 font-bold border border-gray-200 text-xs sm:text-sm">
                        {flight.gate}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-2 sm:px-6 py-3 sm:py-4 text-right">
                    <StatusBadge
                      code={flight.status_code}
                      schedule={flight.schedule_time}
                      time={flight.status_time}
                      direction={direction}
                      desc={flight.status_desc}
                      gateCode={flight.gate_status_code}
                      gateDesc={flight.gate_status_desc}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredFlights.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            {searchQuery
              ? `No flights found matching "${searchQuery}"`
              : "No active flights matching your filters."}
          </div>
        )}
      </div>
      <div className="flex justify-center bg-gray-50 border-t border-gray-200">
        <Link
          className="text-center p-3 text-xs text-gray-500 cursor-pointer hover:underline"
          href="https://avinor.no"
          target="_blank"
        >
          Data provided by Avinor
        </Link>
      </div>
    </div>
  );
}
