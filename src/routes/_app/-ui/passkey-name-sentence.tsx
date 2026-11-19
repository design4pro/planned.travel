/**
 * A character the catalogue never contains. The message is translated with it in place of the name,
 * then split on it, so the name can sit in its own `bdi` and a Latin-script name stays readable
 * inside Arabic text without the message layer growing a markup syntax.
 */
export const PASSKEY_NAME_SLOT = ''

/** A catalogue sentence with the passkey's name in an element that sets its own direction. */
export function PasskeyNameSentence({
  sentence,
  name,
}: {
  sentence: string
  name: string
}) {
  const [before, ...rest] = sentence.split(PASSKEY_NAME_SLOT)
  if (rest.length === 0) return before
  return (
    <>
      {before}
      {rest.map((after, index) => (
        <span key={index}>
          <bdi dir="auto" className="[overflow-wrap:anywhere]">
            {name}
          </bdi>
          {after}
        </span>
      ))}
    </>
  )
}
