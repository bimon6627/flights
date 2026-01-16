import { Suspense } from 'react'
import { getAvinorAirports } from './actions'
import FilterBar from '@/components/filter-bar'
import FlightResults from '@/components/flight-results'
import { clsx } from 'clsx'
import { Metadata } from 'next'
import Footer from '@/components/footer'

export const metadata: Metadata = {
  title: "Flight Schedule Avinor",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ airport?: string; date?: string; direction?: string }>
}) {
  const params = await searchParams
  
  const currentAirport = params.airport || 'BGO'
  const currentDate = params.date || new Date().toISOString().split('T')[0] 
  const currentDirection = (params.direction === 'A' ? 'A' : 'D')

  const airportsList = await getAvinorAirports()
  const currentAirportName = airportsList.find(a => a.code === currentAirport)?.name || currentAirport

  // --- CALCULATE VALID DATE RANGE ---
  const today = new Date()
  const max = new Date()
  const min = new Date()
  max.setDate(today.getDate() + 3)
  min.setDate(today.getDate() - 3)

  const minStr = min.toISOString().split('T')[0]
  const maxStr = max.toISOString().split('T')[0]

  return (
    <div className='min-h-screen flex flex-col justify-between'>
      <main className="flex-grow bg-gray-50 p-4 sm:p-8 mb-auto">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                {currentDirection === 'D' ? 'Departures' : 'Arrivals'}
              </h1>
            </div>
            <p className="text-gray-500 font-medium mt-1">
              {currentAirportName} • {new Date(currentDate).toLocaleDateString('no-NO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <FilterBar 
          airports={airportsList} 
          currentAirport={currentAirport} 
          currentDate={currentDate} 
          currentDirection={currentDirection}
          minDate={minStr}
          maxDate={maxStr}
        />
        <Suspense fallback={
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-4">
            {/* Header / Toolbar Placeholder */}
            <div className="flex justify-between mb-6">
               <div className="h-8 bg-gray-100 rounded animate-pulse w-32" />
               <div className="h-8 bg-gray-100 rounded animate-pulse w-40" />
            </div>
            
            {/* Table Rows Placeholders */}
            <div className="space-y-4">
                <div className="h-12 bg-gray-100 rounded animate-pulse w-full" />
                <div className="h-12 bg-gray-100 rounded animate-pulse w-full" />
                <div className="h-12 bg-gray-100 rounded animate-pulse w-full" />
                <div className="h-12 bg-gray-100 rounded animate-pulse w-full" />
                <div className="h-12 bg-gray-100 rounded animate-pulse w-full" />
            </div>
          </div>
        }>
          <FlightResults 
            airport={currentAirport} 
            date={currentDate} 
            direction={currentDirection}
          />
        </Suspense>
      </div>
    </main>
    <Footer />
    </div>
  )
}