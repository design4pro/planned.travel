/** Shared by name/title writers and their forms; never rewrites the stored text. */
const VISIBLE_CHARACTER = /[\p{L}\p{N}\p{S}\p{P}]/u
const BLANK_CHARACTER = /[\p{Default_Ignorable_Code_Point}\u2800]/u

export function hasVisibleCharacter(name: string): boolean {
  return Array.from(name).some(
    (character) =>
      VISIBLE_CHARACTER.test(character) && !BLANK_CHARACTER.test(character),
  )
}
