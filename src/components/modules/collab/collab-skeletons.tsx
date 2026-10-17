import { Card, Skeleton, TabsContent } from '#/components/ui'
import { CollabTabs } from './collab-tabs'

/** Pending shapes reserve the same sections and mobile navigation as the loaded screen. */
export function CollabSkeletons() {
  return (
    <CollabTabs visible={['conversation', 'notes', 'polls']}>
      <div
        className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)] xl:gap-8"
        aria-busy="true"
      >
        <TabsContent
          value="conversation"
          forceMount
          tabIndex={-1}
          className="mt-0 data-[state=inactive]:hidden xl:data-[state=inactive]:block"
        >
          <Card className="space-y-5">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ))}
            <Skeleton className="h-20 w-full" />
          </Card>
        </TabsContent>
        <div className="min-w-0 space-y-6">
          <TabsContent
            value="notes"
            forceMount
            tabIndex={-1}
            className="mt-0 data-[state=inactive]:hidden xl:data-[state=inactive]:block"
          >
            <Card className="space-y-4">
              <Skeleton className="h-5 w-24" />
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 2 }, (_, index) => (
                  <div
                    key={index}
                    className="space-y-3 rounded-lg border border-edge-faint p-4"
                  >
                    <Skeleton className="h-4 w-2/3" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
          <TabsContent
            value="polls"
            forceMount
            tabIndex={-1}
            className="mt-0 data-[state=inactive]:hidden xl:data-[state=inactive]:block"
          >
            <Card className="space-y-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-3/4" />
              {Array.from({ length: 2 }, (_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </Card>
          </TabsContent>
        </div>
      </div>
    </CollabTabs>
  )
}
