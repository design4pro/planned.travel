# Sonner keyboard lifetime

Issue #1352 patches both distributed entry points of Sonner 2.0.8 so focus inside
the toaster uses its existing expanded-state pause. The timer still owns the
remaining duration, hover, pointer and hidden-document pauses. Focus leaving the
toaster resumes that remaining duration; removing the focused toast clears the
pause so later toasts can expire.

This is a task-scoped exception to the dependency freeze, authorized by the
operator's continuation after the patch and lockfile requirement were presented.
No dependency version or public API changes. `pnpm install --frozen-lockfile`
applies the checked-in patch.

The rendered regression tests live in
`src/components/layout/__tests__/app-toaster.test.tsx`; browser evidence is
recorded under `.ai/qa/artifacts_1352/`. Remove the patch when an upstream release provides the
same focus lifetime behavior and these tests pass without it.
