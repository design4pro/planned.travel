import {
  Cloud,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudMoon,
  CloudSun,
  Moon,
  Sun,
} from 'lucide-react'

import type { LucideIcon } from 'lucide-react'
import type { WeatherCondition, WeatherSlotName } from './weather-model'

/** One icon per condition group, shared by the badge and the panel behind it. */
export const CONDITION_ICON: { readonly [K in WeatherCondition]: LucideIcon } =
  {
    clear: Sun,
    fair: CloudSun,
    partlyCloudy: CloudSun,
    cloudy: Cloud,
    fog: CloudFog,
    rain: CloudRain,
    heavyRain: CloudRainWind,
    sleet: CloudHail,
    snow: CloudSnow,
    thunder: CloudLightning,
  }

/** The conditions that draw a sun, and the moon they draw instead in the Night slot. */
const NIGHT_ICON: { readonly [K in WeatherCondition]?: LucideIcon } = {
  clear: Moon,
  fair: CloudMoon,
  partlyCloudy: CloudMoon,
}

/**
 * The icon of a condition in a slot of the day. The provider's day/night suffix is dropped on the
 * server, so the 00:00-06:00 slot is told apart here; the evening is dark only part of the year and
 * keeps the day icon.
 */
export function slotIcon(
  slot: WeatherSlotName,
  condition: WeatherCondition,
): LucideIcon {
  return (
    (slot === 'night' && NIGHT_ICON[condition]) || CONDITION_ICON[condition]
  )
}
