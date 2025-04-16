"use client"

import type React from "react"

import { useEffect, useState, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"

// Dynamically import Leaflet components with no SSR
const MapComponentsWrapper = dynamic(() => import("@/components/map-components"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[500px] md:h-[700px] bg-gray-100 rounded-lg">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  ),
})

// OpenRouteService API key - in a real app, use environment variables
const ORS_API_KEY = "5b3ce3597851110001cf6248b810056ad87c4299a774ec99546374aa" // Replace with your actual API key

// Default coordinates for Akure city center
const AKURE_CENTER = [7.250771, 5.2103]
const DEFAULT_ZOOM = 13 // Higher zoom level to focus on the city

// Popular places in Akure for suggestions
const POPULAR_PLACES = [
  { name: "FUTA (Federal University of Technology)", state: "Akure", coordinates: [7.3032, 5.1371] },
  { name: "Akure City Mall", state: "Akure", coordinates: [7.2429, 5.1954] },
  { name: "Oja Oba Market", state: "Akure", coordinates: [7.2507, 5.1997] },
  { name: "Akure South Local Government", state: "Akure", coordinates: [7.2517, 5.2022] },
  { name: "State Specialist Hospital", state: "Akure", coordinates: [7.2466, 5.1956] },
  { name: "Ondo State Government House", state: "Akure", coordinates: [7.2634, 5.212] },
  { name: "Akure Township Stadium", state: "Akure", coordinates: [7.2425, 5.2011] },
  { name: "Shoprite Akure", state: "Akure", coordinates: [7.2429, 5.1954] },
  { name: "Alagbaka", state: "Akure", coordinates: [7.2608, 5.2056] },
  { name: "Ijapo Estate", state: "Akure", coordinates: [7.2689, 5.1956] },
  { name: "OBA-ILE", state: "Akure", coordinates: [7.2834, 5.2235] },
  { name: "Oda Road", state: "Akure", coordinates: [7.2372, 5.1923] },
  { name: "Arakale", state: "Akure", coordinates: [7.2483, 5.1912] },
  { name: "Roadblock", state: "Akure", coordinates: [7.2312, 5.1845] },
  { name: "Oke-Ijebu", state: "Akure", coordinates: [7.2578, 5.2134] },
  { name: "Oke-Aro", state: "Akure", coordinates: [7.2512, 5.2245] },
  { name: "Shagari", state: "Akure", coordinates: [7.2423, 5.2156] },
  { name: "Cathedral", state: "Akure", coordinates: [7.2507, 5.1997] },
  { name: "Ondo Road", state: "Akure", coordinates: [7.2312, 5.1789] },
  { name: "Araromi", state: "Akure", coordinates: [7.2456, 5.1876] },
  { name: "Adegbola", state: "Akure", coordinates: [7.2534, 5.1923] },
  { name: "Aule", state: "Akure", coordinates: [7.2712, 5.1834] },
  { name: "Lafe", state: "Akure", coordinates: [7.2623, 5.1789] },
  { name: "Oshinle", state: "Akure", coordinates: [7.2578, 5.1876] },
  { name: "Ado Road", state: "Akure", coordinates: [7.2712, 5.2134] },
  { name: "Old Garage", state: "Akure", coordinates: [7.2483, 5.1967] },
  { name: "Hospital Road", state: "Akure", coordinates: [7.2456, 5.1945] },
]

interface Coordinate {
  lat: number
  lng: number
}

interface Place {
  name: string
  state?: string
  country?: string
  coordinates: [number, number]
  source?: "local" | "api"
}

interface RouteData {
  coordinates: [number, number][]
  summary: {
    distance: number
    duration: number
  }
}

// Function to decode polyline
function decodePolyline(str: string, precision = 5) {
  if (!str || typeof str !== "string") {
    console.error("Invalid polyline string:", str)
    return []
  }

  let index = 0,
    lat = 0,
    lng = 0,
    coordinates = [],
    shift = 0,
    result = 0,
    byte = null,
    latitude_change,
    longitude_change,
    factor = Math.pow(10, precision)

  try {
    // Coordinates have variable length when encoded, so just keep
    // track of whether we've hit the end of the string. In each
    // loop iteration, a single coordinate is decoded.
    while (index < str.length) {
      // Reset shift, result, and byte
      byte = null
      shift = 0
      result = 0

      do {
        byte = str.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20)

      latitude_change = result & 1 ? ~(result >> 1) : result >> 1

      shift = result = 0

      do {
        byte = str.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20)

      longitude_change = result & 1 ? ~(result >> 1) : result >> 1

      lat += latitude_change
      lng += longitude_change

      coordinates.push([lng / factor, lat / factor])
    }
  } catch (e) {
    console.error("Error decoding polyline:", e)
    return []
  }

  return coordinates
}

// Check if a coordinate is within Akure boundaries
function isWithinAkure(lat: number, lng: number): boolean {
  // Define approximate boundaries for Akure
  const AKURE_BOUNDS = {
    north: 7.32, // Northern boundary
    south: 7.2, // Southern boundary
    east: 5.32, // Eastern boundary
    west: 5.12, // Western boundary
  }

  return lat <= AKURE_BOUNDS.north && lat >= AKURE_BOUNDS.south && lng <= AKURE_BOUNDS.east && lng >= AKURE_BOUNDS.west
}

// Function to geocode a place name to coordinates
async function geocodePlaceName(placeName: string): Promise<Place[]> {
  try {
    // Append "Akure" to the search to focus on Akure area
    const searchText = `${placeName}, Akure, Nigeria`
    const response = await fetch(
      `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(
        searchText,
      )}&size=5&boundary.country=NG`,
      {
        method: "GET",
        headers: {
          Accept: "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Geocoding API request failed with status ${response.status}`)
    }

    const data = await response.json()

    if (data.features && data.features.length > 0) {
      return data.features
        .map((feature: any) => {
          const coordinates = feature.geometry.coordinates
          // Check if coordinates are within Akure
          if (isWithinAkure(coordinates[1], coordinates[0]) && feature.properties && feature.properties.name) {
            return {
              name: feature.properties.name,
              state: feature.properties.region || "Akure",
              country: feature.properties.country || "Nigeria",
              // OpenRouteService returns coordinates as [longitude, latitude]
              coordinates: [coordinates[1], coordinates[0]] as [number, number],
              source: "api" as const,
            }
          }
          return null
        })
        .filter(Boolean)
    }
    return []
  } catch (error) {
    console.error("Error geocoding place name:", error)
    return []
  }
}

// Debounce function to limit API calls
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Place selector component with suggestions
function PlaceSelector({
  value,
  onChange,
  placeholder,
  useCurrentLocation,
}: {
  value: string
  onChange: (value: string, coordinates?: [number, number]) => void
  placeholder: string
  useCurrentLocation?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<Place[]>([])
  const [apiResults, setApiResults] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Debounce the input value to prevent too many API calls
  const debouncedInputValue = useDebounce(inputValue, 300)

  // Update input value when value prop changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Handle clicks outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Filter local places based on input
  useEffect(() => {
    if (!inputValue) {
      setSearchResults(POPULAR_PLACES.slice(0, 5).map((place) => ({ ...place, source: "local" as const })))
      return
    }

    const lowerValue = inputValue.toLowerCase()
    const filtered = POPULAR_PLACES.filter(
      (place) =>
        place.name.toLowerCase().includes(lowerValue) ||
        (place.state && place.state.toLowerCase().includes(lowerValue)),
    )
      .slice(0, 5)
      .map((place) => ({ ...place, source: "local" as const }))

    setSearchResults(filtered)
  }, [inputValue])

  // Fetch from API when debounced input changes and has at least 3 characters
  useEffect(() => {
    const fetchPlaces = async () => {
      if (debouncedInputValue.length >= 3) {
        setIsSearching(true)
        const results = await geocodePlaceName(debouncedInputValue)
        setApiResults(results)
        setIsSearching(false)
      } else {
        setApiResults([])
      }
    }

    fetchPlaces()
  }, [debouncedInputValue])

  // Combine local and API results, removing duplicates
  const combinedResults = useCallback(() => {
    // First add all local results
    const combined = [...searchResults]

    // Then add API results that don't duplicate local results
    if (apiResults.length > 0) {
      const localNames = new Set(searchResults.map((place) => place.name.toLowerCase()))

      apiResults.forEach((apiPlace) => {
        if (!localNames.has(apiPlace.name.toLowerCase())) {
          combined.push(apiPlace)
        }
      })
    }

    // Limit to 10 total results
    return combined.slice(0, 10)
  }, [searchResults, apiResults])

  const getCurrentLocation = () => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      setLoading(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords

          // Check if current location is within Akure
          if (isWithinAkure(latitude, longitude)) {
            onChange("My Current Location", [latitude, longitude])
            setInputValue("My Current Location")
          } else {
            // If outside Akure, use Akure center
            onChange("Akure City Center", [AKURE_CENTER[0], AKURE_CENTER[1]])
            setInputValue("Akure City Center")
            alert("Your location is outside Akure. Using Akure city center instead.")
          }
          setLoading(false)
        },
        (err) => {
          console.error(err)
          setLoading(false)
        },
      )
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setOpen(true) // Open suggestions when typing
  }

  // Handle form submission when user presses Enter
  const handleInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue) {
      e.preventDefault()

      // Check if the input matches any of the combined results
      const allResults = combinedResults()
      const matchedPlace = allResults.find((place) => place.name.toLowerCase() === inputValue.toLowerCase())

      if (matchedPlace) {
        // If we have a match, use it directly
        onChange(matchedPlace.name, matchedPlace.coordinates)
        setOpen(false)
        return
      }

      // Otherwise, try to geocode the input
      setLoading(true)
      const results = await geocodePlaceName(inputValue)

      if (results.length > 0) {
        // Use the first result
        onChange(results[0].name, results[0].coordinates)
        setOpen(false)
      } else {
        alert("Could not find this location. Please try a different name or select from the suggestions.")
      }

      setLoading(false)
    }
  }

  const handleSelectPlace = (place: Place) => {
    setInputValue(place.name)
    onChange(place.name, place.coordinates)
    setOpen(false)
  }

  // Get all results to display
  const allResults = combinedResults()

  return (
    <div className="flex gap-2">
      <div className="relative w-full">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full"
        />

        {open && (
          <div
            ref={suggestionsRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {isSearching && (
              <div className="px-4 py-2 text-sm text-gray-500 flex items-center">
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                Searching...
              </div>
            )}

            {!isSearching && allResults.length === 0 && (
              <div className="px-4 py-2 text-sm text-gray-500">No places found</div>
            )}

            {allResults.length > 0 && (
              <ul>
                {allResults.map((place, index) => (
                  <li
                    key={`${place.name}-${place.coordinates.join(",")}-${index}`}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"
                    onClick={() => handleSelectPlace(place)}
                  >
                    <MapPin
                      className={`mr-2 h-4 w-4 flex-shrink-0 ${place.source === "api" ? "text-green-500" : "text-red-500"}`}
                    />
                    <div className="truncate-text-container">
                      <span className="truncate-text">{place.name}</span>
                      {place.state && <span className="ml-1 text-gray-500 text-xs">{place.state}</span>}
                    </div>
                    {place.source === "api" && (
                      <span className="ml-auto text-xs text-green-600 flex-shrink-0">API</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {useCurrentLocation && (
        <Button
          type="button"
          variant="outline"
          onClick={getCurrentLocation}
          title="Use my location"
          disabled={loading}
          className="px-2 flex-shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4 text-red-500" />}
        </Button>
      )}
    </div>
  )
}

export default function Home() {
  const [startPlace, setStartPlace] = useState("")
  const [endPlace, setEndPlace] = useState("")
  const [startCoord, setStartCoord] = useState<Coordinate | null>(null)
  const [endCoord, setEndCoord] = useState<Coordinate | null>(null)
  const [routes, setRoutes] = useState<RouteData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAlternatives, setShowAlternatives] = useState(false)

  // Function to fetch routes from OpenRouteService
  const fetchRoutes = async (alternatives = false) => {
    if (!startCoord || !endCoord) {
      setError("Please select valid start and end locations")
      return
    }

    // Check if both coordinates are within Akure
    if (!isWithinAkure(startCoord.lat, startCoord.lng) || !isWithinAkure(endCoord.lat, endCoord.lng)) {
      setError("Both start and destination must be within Akure city limits")
      return
    }

    setLoading(true)
    setError(null)

    if (!alternatives) {
      setRoutes([])
      setShowAlternatives(false)
    }

    try {
      // Using the directions API with POST for alternative routes
      const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: ORS_API_KEY,
        },
        body: JSON.stringify({
          coordinates: [
            [startCoord.lng, startCoord.lat],
            [endCoord.lng, endCoord.lat],
          ],
          alternative_routes: alternatives
            ? {
                target_count: 3,
                weight_factor: 1.6,
              }
            : undefined,
          format: "json",
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("API Error:", errorText)
        throw new Error(`API request failed with status ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      console.log("API Response:", data)

      // Check if data and data.routes exist before processing
      if (!data || !data.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
        console.error("Unexpected API response format:", data)
        throw new Error("No routes found between these locations")
      }

      // Process the routes with the new format
      const processedRoutes = data.routes
        .map((route: any) => {
          if (!route.geometry) {
            console.error("Invalid route format:", route)
            throw new Error("Route data is in an unexpected format")
          }

          // Decode the polyline to get coordinates
          const coordinates = decodePolyline(route.geometry)

          if (!coordinates || coordinates.length === 0) {
            throw new Error("Failed to decode route coordinates")
          }

          return {
            coordinates: coordinates as [number, number][],
            summary: {
              distance: route.summary?.distance || 0,
              duration: route.summary?.duration || 0,
            },
          }
        })
        .filter((route) => route.coordinates.length > 0)

      if (processedRoutes.length === 0) {
        throw new Error("No valid routes found between these locations")
      }

      setRoutes(processedRoutes)
      setShowAlternatives(alternatives)
    } catch (err) {
      console.error("Error fetching routes:", err)
      setError(
        err instanceof Error ? err.message : "Failed to fetch routes. Please check your locations and try again.",
      )
      setRoutes([])
    } finally {
      setLoading(false)
    }
  }

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchRoutes(false)
  }

  // Handle getting alternative routes
  const handleGetAlternatives = () => {
    fetchRoutes(true)
  }

  // Handle place selection
  const handleStartPlaceChange = (value: string, coordinates?: [number, number]) => {
    setStartPlace(value)
    if (coordinates) {
      setStartCoord({ lat: coordinates[0], lng: coordinates[1] })
    }
  }

  const handleEndPlaceChange = (value: string, coordinates?: [number, number]) => {
    setEndPlace(value)
    if (coordinates) {
      setEndCoord({ lat: coordinates[0], lng: coordinates[1] })
    }
  }

  // Format duration from seconds to minutes/hours
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} sec`
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.round((seconds % 3600) / 60)
    return `${hours} hr ${minutes} min`
  }

  // Format distance from meters to km
  const formatDistance = (meters: number) => {
    return `${(meters / 1000).toFixed(1)} km`
  }

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Akure City Route Finder</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Find Routes in Akure</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Location</label>
                <PlaceSelector
                  value={startPlace}
                  onChange={handleStartPlaceChange}
                  placeholder="Enter start location in Akure"
                  useCurrentLocation
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Destination</label>
                <PlaceSelector
                  value={endPlace}
                  onChange={handleEndPlaceChange}
                  placeholder="Enter destination in Akure"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && !showAlternatives ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finding Route...
                  </>
                ) : (
                  "Find Route"
                )}
              </Button>
            </form>

            {error && <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-md text-sm">{error}</div>}

            {routes.length > 0 && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">{showAlternatives ? "Alternative Routes" : "Route"}</h3>
                  {!showAlternatives && routes.length > 0 && (
                    <Button variant="outline" size="sm" onClick={handleGetAlternatives} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Show Alternatives"}
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {routes.map((route, index) => (
                    <div
                      key={index}
                      className="p-3 border rounded-md flex items-center"
                      style={{
                        borderLeftColor: ["#3388ff", "#ff3333", "#33cc33", "#9933ff", "#ff9900"][index % 5],
                        borderLeftWidth: "4px",
                      }}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{showAlternatives ? `Route ${index + 1}` : "Main Route"}</div>
                        <div className="text-sm text-gray-500">
                          {formatDistance(route.summary.distance)} • {formatDuration(route.summary.duration)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <h3 className="font-medium mb-2">Popular Places in Akure</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {POPULAR_PLACES.slice(0, 8).map((place) => (
                  <Button
                    key={place.name}
                    variant="outline"
                    size="sm"
                    className="justify-start h-auto py-1 px-2 overflow-hidden"
                    onClick={() => handleEndPlaceChange(place.name, place.coordinates)}
                  >
                    <MapPin className="mr-1 h-3 w-3 flex-shrink-0 text-red-500" />
                    <div className="truncate-text-container">
                      <span className="truncate-text">{place.name}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 h-[500px] md:h-[700px]">
          <MapComponentsWrapper
            startCoord={startCoord}
            endCoord={endCoord}
            routes={routes}
            center={AKURE_CENTER}
            zoom={DEFAULT_ZOOM}
          />
        </div>
      </div>
    </main>
  )
}
