/**
 * Product components for the settings module.
 *
 * Presentational only: nothing here fetches, and nothing here imports from
 * `src/server`. A settings route loads its own data, hands it down as props and
 * takes the change back through a callback.
 */

export {
  FOLLOW_WORKSPACE,
  LanguagePicker,
  LanguagePickerSkeleton,
} from './language-picker'
export type { LanguagePickerProps, LocaleChoice } from './language-picker'
