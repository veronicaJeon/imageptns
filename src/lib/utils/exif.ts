// NOTE: exifr is not in package.json — run `npm install exifr` before using this module.
import exifr from 'exifr'

export type ExifData = {
  takenAt: Date | null
  lat: number | null
  lng: number | null
  altitude: number | null
  camera: string | null        // "Make Model" e.g. "Canon EOS R5"
  lensModel: string | null
  locationLabel: string | null // "Seoul, South Korea" from GPS if available
  // Exposure
  iso: number | null
  aperture: number | null      // F-number e.g. 2.8
  shutterSpeed: string | null  // e.g. "1/500" or "2s"
  focalLength: number | null   // mm
  focalLength35mm: number | null
  flash: string | null
  whiteBalance: string | null
  exposureMode: string | null
  meteringMode: string | null
  // Image info
  colorSpace: string | null
  orientation: number | null
  software: string | null
  // Raw: all remaining fields for display
  rawFields: Record<string, unknown>
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

function formatShutterSpeed(v: number | null | undefined): string | null {
  if (v == null) return null
  if (v >= 1) return `${v}s`
  const denom = Math.round(1 / v)
  return `1/${denom}`
}

function formatFlash(v: number | null | undefined): string | null {
  if (v == null) return null
  // EXIF Flash tag: bit 0 = fired, bits 1-2 = return, bits 3-4 = mode, bit 5 = present, bit 6 = redeye
  const fired = (v & 0x01) !== 0
  return fired ? '발광됨' : '발광 안 됨'
}

function formatWhiteBalance(v: number | null | undefined): string | null {
  if (v == null) return null
  return v === 0 ? 'Auto' : v === 1 ? 'Manual' : String(v)
}

function formatExposureMode(v: number | null | undefined): string | null {
  if (v == null) return null
  const modes: Record<number, string> = { 0: 'Auto', 1: 'Manual', 2: 'Auto bracket' }
  return modes[v] ?? String(v)
}

function formatMeteringMode(v: number | null | undefined): string | null {
  if (v == null) return null
  const modes: Record<number, string> = {
    0: 'Unknown', 1: 'Average', 2: 'Center-weighted', 3: 'Spot',
    4: 'Multi-spot', 5: 'Pattern', 6: 'Partial', 255: 'Other',
  }
  return modes[v] ?? String(v)
}

function formatColorSpace(v: number | null | undefined): string | null {
  if (v == null) return null
  return v === 1 ? 'sRGB' : v === 65535 ? 'Uncalibrated' : String(v)
}

// Fields we extract structurally — exclude from rawFields display
const KNOWN_KEYS = new Set([
  'DateTimeOriginal','CreateDate','Make','Model','LensModel','LensInfo',
  'latitude','longitude','GPSAltitude','GPSAltitudeRef',
  'ISO','ISOSpeedRatings','ExposureTime','FNumber',
  'FocalLength','FocalLengthIn35mmFormat','Flash',
  'WhiteBalance','ExposureMode','MeteringMode',
  'ColorSpace','Orientation','Software',
])

export async function extractExif(file: File): Promise<ExifData> {
  const result: ExifData = {
    takenAt: null, lat: null, lng: null, altitude: null,
    camera: null, lensModel: null, locationLabel: null,
    iso: null, aperture: null, shutterSpeed: null, focalLength: null, focalLength35mm: null,
    flash: null, whiteBalance: null, exposureMode: null, meteringMode: null,
    colorSpace: null, orientation: null, software: null,
    rawFields: {},
  }

  try {
    const raw = await exifr.parse(file, {
      gps: true,
      tiff: true,
      exif: true,
      xmp: false,
      icc: false,
      iptc: false,
    })

    if (!raw) return result

    // takenAt
    const dateRaw = raw.DateTimeOriginal ?? raw.CreateDate ?? null
    if (dateRaw instanceof Date) result.takenAt = dateRaw
    else if (typeof dateRaw === 'string') {
      const parsed = new Date(dateRaw)
      if (!isNaN(parsed.getTime())) result.takenAt = parsed
    }

    // GPS
    result.lat = typeof raw.latitude === 'number' ? raw.latitude : null
    result.lng = typeof raw.longitude === 'number' ? raw.longitude : null
    const altRaw = raw.GPSAltitude
    if (typeof altRaw === 'number') {
      const ref = raw.GPSAltitudeRef
      result.altitude = (ref === 1 || ref === '1') ? -altRaw : altRaw
    }

    // Camera
    const make = typeof raw.Make === 'string' ? raw.Make.trim() : ''
    const model = typeof raw.Model === 'string' ? raw.Model.trim() : ''
    result.camera = [make, model].filter(Boolean).join(' ') || null
    result.lensModel = typeof raw.LensModel === 'string' ? raw.LensModel.trim() : null

    // Exposure
    result.iso = raw.ISO ?? raw.ISOSpeedRatings ?? null
    result.aperture = typeof raw.FNumber === 'number' ? raw.FNumber : null
    result.shutterSpeed = formatShutterSpeed(raw.ExposureTime)
    result.focalLength = typeof raw.FocalLength === 'number' ? raw.FocalLength : null
    result.focalLength35mm = typeof raw.FocalLengthIn35mmFormat === 'number' ? raw.FocalLengthIn35mmFormat : null
    result.flash = formatFlash(raw.Flash)
    result.whiteBalance = formatWhiteBalance(raw.WhiteBalance)
    result.exposureMode = formatExposureMode(raw.ExposureMode)
    result.meteringMode = formatMeteringMode(raw.MeteringMode)

    // Image info
    result.colorSpace = formatColorSpace(raw.ColorSpace)
    result.orientation = typeof raw.Orientation === 'number' ? raw.Orientation : null
    result.software = typeof raw.Software === 'string' ? raw.Software.trim() : null

    // Collect remaining interesting fields into rawFields
    for (const [key, val] of Object.entries(raw)) {
      if (KNOWN_KEYS.has(key)) continue
      if (val == null) continue
      if (typeof val === 'object' && !(val instanceof Date)) continue
      result.rawFields[key] = val
    }

    // Reverse geocode if GPS is present; fall back to raw coordinates
    if (result.lat !== null && result.lng !== null) {
      result.locationLabel = await reverseGeocode(result.lat, result.lng)
      if (!result.locationLabel) {
        result.locationLabel = `${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`
      }
    }
  } catch {
    // Return whatever partial data was collected; nulls are fine on failure
  }

  return result
}
