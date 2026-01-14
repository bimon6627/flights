import { getFlights } from '@/app/actions' // Fetch logic
import FlightsTable from '@/components/flights-table' // Display logic

export default async function FlightResults({ 
  airport, 
  date, 
  direction 
}: { 
  airport: string, 
  date: string, 
  direction: 'A' | 'D' 
}) {
  // This AWAIT is what takes time. By moving it here, only this part waits.
  const { flights, airlineMap, airportMap } = await getFlights(airport, date, direction)

  return (
    <FlightsTable 
      flights={flights}
      airlineMap={airlineMap}
      airportMap={airportMap}
      direction={direction}
    />
  )
}