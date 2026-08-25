Catalogue-shaped fixtures.

`messages/` mirrors the layout `docs/SPEC.md` §8 fixes — `<locale>/<namespace>.ts`
default-exporting one flat object of keys — and deliberately also carries a
`de.ts` in the *old* flat shape, so `parity.test.ts` can prove that the glob
pattern the loader and the gate both use matches `messages/de/settings.ts` and
does not match `messages/de.ts`. Nothing here is shipped copy.
