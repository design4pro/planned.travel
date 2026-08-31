# reservations-and-transport baselines

This plan's baseline directory, per `docs/plans/12-verification-protocol.md` §4:
`playwright.config.ts` templates snapshots as
`{snapshotDir}/{testFileName}/{arg}-{projectName}{ext}`, so this directory is the
one `e2e/reservations-and-transport.visual.spec.ts` writes into and it cannot
collide with `e2e/__screenshots__/visual.spec.ts/`.

It is empty of frames on purpose. `03-S1` created the spec file and asserted
everything about the transports tab that is not a picture — the published
selector, the relabelled controls in the open dialog, a silent console, no layout
shift after the settle. Recording a frame means running Playwright with
`--update-snapshots`, which the implementation loop is forbidden to do, and the
ticket declares no visual change for the orchestrator to re-record. Whoever
records the first frames records them here.
