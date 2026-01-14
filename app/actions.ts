'use server'

import { prisma } from '@/lib/prisma'

// --- View Model ---
export type FlightViewModel = {
  uniqueId: string
  flightId: string
  airline: string | null
  from_airport: string
  to_airport: string
  schedule_time: Date
  gate: string | null
  status_code: string | null
  status_time: Date | null
  check_in: string | null
  belt: string | null
  dom_int: string | null
}

export type FlightsData = {
  flights: FlightViewModel[]
  airlineMap: Record<string, string>
  airportMap: Record<string, string>
  direction: 'A' | 'D'
}

export async function getAvinorAirports() {
  return await prisma.avinorAirports.findMany({
    select: { code: true, name: true },
    orderBy: { name: 'asc' },
  })
}

export async function getFlights(
  airportCode: string, 
  dateStr?: string, 
  direction: 'A' | 'D' = 'D'
): Promise<FlightsData> {
  const baseDate = dateStr ? new Date(dateStr) : new Date()
  
  const startOfDay = new Date(baseDate)
  startOfDay.setHours(0, 0, 0, 0)
  
  const endOfDay = new Date(baseDate)
  endOfDay.setHours(23, 59, 59, 999)

  // 1. Fetch from the new "Airport-Centric" Schema
  // We simply ask: "Show me the board for this specific airport"
  const rawFlights = await prisma.flights.findMany({
    where: {
      scanned_airport: airportCode,
      direction: direction,
      schedule_time: { gte: startOfDay, lte: endOfDay }
    },
    orderBy: { schedule_time: 'asc' }
  })

  // 2. Map to View Model (Handling VIA Logic)
  const mappedFlights: FlightViewModel[] = rawFlights.flatMap((f) => {
    
    // Determine From/To logic based on the board we are looking at
    // If we are at BGO (Departure): FROM = BGO, TO = Destination
    // If we are at BGO (Arrival): FROM = Origin, TO = BGO
    const from_airport = direction === 'D' ? f.scanned_airport : f.related_airport
    const to_airport   = direction === 'D' ? f.related_airport : f.scanned_airport

    const baseFlight: FlightViewModel = {
      uniqueId: f.uniqueId,
      flightId: f.flightId,
      airline: f.airline,
      from_airport,
      to_airport,
      schedule_time: f.schedule_time,
      gate: f.gate,
      status_code: f.status_code,
      status_time: f.status_time,
      check_in: f.check_in,
      belt: f.belt,
      dom_int: f.dom_int
    }

    // --- RESTORED VIA LOGIC ---
    // If we are looking at Departures, and there are stopovers, create "ghost" flights.
    if (direction === 'D' && f.via && f.via.length > 0) {
      const flightsToReturn = [baseFlight]

      f.via.forEach((viaAirportCode) => {
        flightsToReturn.push({
          ...baseFlight,
          // Create a composite ID so React doesn't complain about duplicates
          uniqueId: `${f.uniqueId}-${viaAirportCode}`, 
          // Override destination to show the stopover
          to_airport: viaAirportCode 
        })
      })

      return flightsToReturn
    }

    return [baseFlight]
  })

  // 3. Fetch Names (Airlines/Airports)
  const unique = (arr: (string | null)[]) => [...new Set(arr.filter(Boolean))] as string[]
  
  const airlineCodes = unique(mappedFlights.map(f => f.airline))
  
  // Collect ALL airport codes (Origins, Final Destinations, AND Via stops)
  const airportCodes = unique([
    ...mappedFlights.map(f => f.to_airport),
    ...mappedFlights.map(f => f.from_airport)
  ])

  // Run lookups in parallel
  const [airlines, globalAirports] = await Promise.all([
    prisma.airlineNames.findMany({ where: { code: { in: airlineCodes } } }),
    prisma.airportNames.findMany({ where: { code: { in: airportCodes } } })
  ])

  // 4. Build Lookup Maps
  const airlineMap: Record<string, string> = {}
  airlines.forEach((a) => airlineMap[a.code] = a.name)

  const airportMap: Record<string, string> = {}
  globalAirports.forEach((a) => airportMap[a.code] = a.name)

  return { 
    flights: mappedFlights, 
    airlineMap, 
    airportMap, 
    direction 
  }
}