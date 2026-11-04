import { useTranslate } from '#/lib/i18n'

export const ECB_SOURCE =
  'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html'

export function FreeRateDisclosure() {
  const t = useTranslate()
  return (
    <p className="text-caption text-ink-3">
      <a
        href={ECB_SOURCE}
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        {t('shell.dashboard.currency.free')}
      </a>
    </p>
  )
}
