import {
  Cloud,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Sun,
} from 'lucide-react'

import type { LucideIcon } from 'lucide-react'
import type { WeatherCondition } from './weather-model'

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
