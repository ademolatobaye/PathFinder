"use client"

import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, Polyline, useMap, Rectangle } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

// Define SVG icon for markers
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="red" width="36" height="36">
  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
</svg>
`

// Create a custom icon using the SVG
const createCustomIcon = () => {
  return L.divIcon({
    className: "custom-icon",
    html: svgIcon,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  })
}

// Define approximate boundaries for Akure
const AKURE_BOUNDS = {
  north: 7.32, // Northern boundary
  south: 7.2, // Southern boundary
  east: 5.32, // Eastern boundary
  west: 5.12, // Western boundary
}

// Colors for different routes
const ROUTE_COLORS = ["#3388ff", "#ff3333", "#33cc33", "#9933ff", "#ff9900"]

interface Coordinate {
  lat: number
  lng: number
}

interface RouteData {
  coordinates: [number, number][]
  summary: {
    distance: number
    duration: number
  }
}

// Component to recenter map when coordinates change
function MapController({
  startCoord,
  endCoord,
  routes,
  center,
  zoom,
}: {
  startCoord: Coordinate | null
  endCoord: Coordinate | null
  routes: RouteData[]
  center: [number, number]
  zoom: number
}) {
  const map = useMap()

  useEffect(() => {
    if (routes.length > 0) {
      // Create bounds from all route coordinates
      const bounds = L.latLngBounds([])
      routes.forEach((route) => {
        route.coordinates.forEach((coord) => {
          bounds.extend([coord[1], coord[0]])
        })
      })

      // Make sure we don't zoom out too far from Akure
      const akureBounds = L.latLngBounds(
        [AKURE_BOUNDS.south, AKURE_BOUNDS.west],
        [AKURE_BOUNDS.north, AKURE_BOUNDS.east],
      )

      // Use the intersection of route bounds and Akure bounds
      const finalBounds = bounds.intersects(akureBounds) ? bounds : akureBounds

      map.fitBounds(finalBounds, { padding: [50, 50], maxZoom: 15 })
    } else if (startCoord && endCoord) {
      map.fitBounds(
        [
          [startCoord.lat, startCoord.lng],
          [endCoord.lat, endCoord.lng],
        ],
        { padding: [50, 50], maxZoom: 15 },
      )
    } else if (startCoord) {
      map.setView([startCoord.lat, startCoord.lng], 14)
    } else {
      // Default view of Akure
      map.setView(center, zoom)
    }
  }, [map, startCoord, endCoord, routes, center, zoom])

  return null
}

export default function MapComponents({
  startCoord,
  endCoord,
  routes,
  center = [7.250771, 5.2103], // Default to Akure center
  zoom = 13, // Default zoom level for city view
}: {
  startCoord: Coordinate | null
  endCoord: Coordinate | null
  routes: RouteData[]
  center?: [number, number]
  zoom?: number
}) {
  // Initialize custom icon when component mounts
  useEffect(() => {
    // Add CSS for the custom icon
    const style = document.createElement("style")
    style.textContent = `
      .custom-icon {
        background: none;
        border: none;
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // Create Akure boundary rectangle
  const akureBoundaryRectangle = [
    [AKURE_BOUNDS.south, AKURE_BOUNDS.west],
    [AKURE_BOUNDS.north, AKURE_BOUNDS.east],
  ]

  return (
    <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Add a subtle rectangle to show Akure boundaries */}
      <Rectangle
        bounds={akureBoundaryRectangle as L.LatLngBoundsExpression}
        pathOptions={{ color: "#3388ff", weight: 2, fillOpacity: 0.05 }}
      />

      <MapController startCoord={startCoord} endCoord={endCoord} routes={routes} center={center} zoom={zoom} />

      {startCoord && <Marker position={[startCoord.lat, startCoord.lng]} icon={createCustomIcon()} />}

      {endCoord && <Marker position={[endCoord.lat, endCoord.lng]} icon={createCustomIcon()} />}

      {routes &&
        routes.length > 0 &&
        routes.map((route, index) => (
          <Polyline
            key={index}
            positions={route.coordinates.map((coord) => [coord[1], coord[0]])}
            color={ROUTE_COLORS[index % ROUTE_COLORS.length]}
            weight={5}
            opacity={0.7}
          />
        ))}
    </MapContainer>
  )
}
