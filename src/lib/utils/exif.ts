// NOTE: exifr is not in package.json — run `npm install exifr` before using this module.
import exifr from 'exifr'

export type ExifData = {
  takenAt: Date | null
  lat: number | null
  lng: number | null
  camera: string | null        // "Make Model" e.g. "Canon EOS R5"
  locationLabel: string | null // "Seoul, South Korea" from GPS if available
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'ImagePartners/1.0 (imageptns.vercel.app)',
      },
    })
    if (!res.ok) return null
    const data = await res.json()
    // Use structured address for a clean "City, Country" label
    const addr = data?.address
    if (addr) {
      const city = addr.city || addr.town || addr.village || addr.county || addr.state
      const country = addr.country
      if (city && country) return `${city}, ${country}`
      if (country) return country
    }
    // Fallback: last 2 comma-separated parts of display_name
    const displayName: string | undefined = data?.display_name
    if (!displayName) return null
    const parts = displayName.split(',').map((p: string) => p.trim()).filter(Boolean)
    return parts.slice(-2).join(', ')
  } catch {
    return null
  }
}

export async function extractExif(file: File): Promise<ExifData> {
  const result: ExifData = {
    takenAt: null,
    lat: null,
    lng: null,
    camera: null,
    locationLabel: null,
  }

  try {
    const raw = await exifr.parse(file, {
      gps: true,
      tiff: true,
      xmp: false,
      icc: false,
      iptc: false,
    })

    if (!raw) return result

    // takenAt: prefer DateTimeOriginal, fall back to CreateDate
    const dateRaw = raw.DateTimeOriginal ?? raw.CreateDate ?? null
    if (dateRaw instanceof Date) {
      result.takenAt = dateRaw
    } else if (typeof dateRaw === 'string') {
      const parsed = new Date(dateRaw)
      if (!isNaN(parsed.getTime())) result.takenAt = parsed
    }

    // GPS coordinates
    const lat = typeof raw.latitude === 'number' ? raw.latitude : null
    const lng = typeof raw.longitude === 'number' ? raw.longitude : null
    result.lat = lat
    result.lng = lng

    // Camera: "Make Model", trimmed
    const make = typeof raw.Make === 'string' ? raw.Make.trim() : ''
    const model = typeof raw.Model === 'string' ? raw.Model.trim() : ''
    const camera = [make, model].filter(Boolean).join(' ')
    result.camera = camera || null

    // Reverse geocode if GPS is present; fall back to raw coordinates
    if (lat !== null && lng !== null) {
      result.locationLabel = await reverseGeocode(lat, lng)
      if (!result.locationLabel) {
        result.locationLabel = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      }
    }
  } catch {
    // Return whatever partial data was collected; nulls are fine on failure
  }

  return result
}
