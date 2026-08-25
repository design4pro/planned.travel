import { useEffect, useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { Search, SearchX, Users } from 'lucide-react'
import { z } from 'zod'

import { ErrorPanel } from '#/components/layout/error-state'
import {
  AccountIdentity,
  AccountStatus,
  PlatformRoleBadge,
  VerificationMark,
  displayPlatformRole,
} from '#/components/console'
import {
  Button,
  Card,
  EmptyState,
  Input,
  Pagination,
  SimpleSelect,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { CONSOLE_USERS_PAGE_SIZE, loadConsoleUsers } from './-server/users'
import { CreateAccountButton } from './-ui/create-account'
import { UserActions } from './-ui/user-actions'
import { formatDate, formatNumber } from '../-lib/format'
import { Panel, RowsSkeleton } from '../-ui/scaffold'

import type { ConsoleUser } from '#/server/fns/console/projections'

/**
 * The addressable state of this screen.
 *
 * Every control writes here rather than into component state, so a filtered, sorted page is a URL
 * somebody can send to the admin next to them and the back button walks the reader's own history.
 * Nothing carries a `.default()`: a default in the schema is re-serialised into the address on every
 * navigation, and `/console/users` would immediately become
 * `/console/users?sort=createdAt&dir=desc&page=1`. The defaults live where they are used instead.
 */
const searchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  /** Which column the search text is matched against; `list-users` accepts exactly one. */
  in: z.enum(['email', 'name']).optional(),
  role: z.enum(['admin', 'curator']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'name', 'email']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  page: z.number().int().min(1).max(4_000).optional(),
})

type UsersSearch = z.infer<typeof searchSchema>

/**
 * The accounts table. Its guard is one level up, in `users.tsx`, so this screen and the account
 * screen beside it cannot answer "may a curator be here" differently.
 *
 * **Server-paginated, server-sorted, server-filtered.** `loadConsoleUsers` hands the search state
 * below to `listPlatformUsersFn`, which passes a closed sort vocabulary and one filter clause to
 * `auth.api.listUsers`; that endpoint counts under the same predicate it lists under, so `total` is
 * the count of what the filters select rather than the size of the table. Nothing is virtualized and
 * nothing needs to be: twenty-five rows arrive per request.
 *
 * **A role filter and a status filter cannot both be set**, because `list-users` builds at most one
 * filter clause beside the search clause and would silently drop the second. Both server schemas
 * refuse the pair; the two controls below clear each other so the refusal is never reached, and the
 * one that is inert says so by being disabled rather than by looking available.
 */
export const Route = createFileRoute('/_app/console/users/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) =>
    await loadConsoleUsers({
      data: {
        ...(deps.q === undefined ? {} : { q: deps.q }),
        field: deps.in ?? 'email',
        ...(deps.role === undefined ? {} : { role: deps.role }),
        ...(deps.status === undefined ? {} : { status: deps.status }),
        sortBy: deps.sort ?? 'createdAt',
        sortDirection: deps.dir ?? 'desc',
        page: deps.page ?? 1,
      },
    }),
  pendingComponent: UsersPending,
  errorComponent: ({ error }) => (
    <ErrorPanel
      className="bg-surface-2"
      error={error}
      title="The accounts list did not load"
    />
  ),
  component: ConsoleUsersPage,
})

const ROLE_OPTIONS = [
  { value: 'any', label: 'Any role' },
  { value: 'admin', label: 'Admins' },
  { value: 'curator', label: 'Curators' },
]

const STATUS_OPTIONS = [
  { value: 'any', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
]

const FIELD_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'name', label: 'Name' },
]

function ConsoleUsersPage() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const { shell } = Route.useRouteContext()

  const [query, setQuery] = useState(search.q ?? '')
  // The address is the source of truth: a "clear filters" link or the back button has to be able to
  // empty the box, and only the URL knows it happened.
  useEffect(() => {
    setQuery(search.q ?? '')
  }, [search.q])

  const sort = search.sort ?? 'createdAt'
  const dir = search.dir ?? 'desc'
  const pageCount = Math.max(1, Math.ceil(data.total / CONSOLE_USERS_PAGE_SIZE))
  const filtered =
    (search.q !== undefined && search.q.length > 0) ||
    search.role !== undefined ||
    search.status !== undefined

  /** Every control lands here, and every control resets the page: page 7 of a new filter is nowhere. */
  function apply(next: Partial<UsersSearch>): void {
    void navigate({
      search: { ...search, page: undefined, ...next },
      replace: true,
    })
  }

  function sortBy(field: 'createdAt' | 'updatedAt' | 'name' | 'email'): void {
    apply({
      sort: field,
      dir: sort === field && dir === 'desc' ? 'asc' : 'desc',
    })
  }

  function directionOf(
    field: 'createdAt' | 'updatedAt' | 'name' | 'email',
  ): 'asc' | 'desc' | null {
    return sort === field ? dir : null
  }

  async function refresh(): Promise<void> {
    await router.invalidate()
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel
        label="Accounts"
        count={`${formatNumber(data.total)} total`}
        flush
        action={<CreateAccountButton onCreated={refresh} />}
        toolbar={
          <div className="flex flex-col gap-3">
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                apply({ q: query.trim() === '' ? undefined : query.trim() })
              }}
            >
              <Input
                className="min-w-0"
                wrapperClassName="min-w-48 flex-1 basis-56"
                size="sm"
                type="text"
                value={query}
                aria-label="Search accounts"
                placeholder={
                  (search.in ?? 'email') === 'email'
                    ? 'Search email addresses'
                    : 'Search names'
                }
                leading={<Search className="size-4" />}
                onChange={(event) => {
                  setQuery(event.currentTarget.value)
                }}
                onClear={() => {
                  setQuery('')
                  apply({ q: undefined })
                }}
              />
              <SimpleSelect
                size="sm"
                className="w-28"
                ariaLabel="Search which column"
                value={search.in ?? 'email'}
                onValueChange={(value) => {
                  apply({ in: value === 'email' ? undefined : 'name' })
                }}
                options={FIELD_OPTIONS.map((option) => ({ ...option }))}
              />
              <Button type="submit" variant="secondary" size="sm">
                Search
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <SimpleSelect
                size="sm"
                className="w-36"
                ariaLabel="Filter by platform role"
                disabled={search.status !== undefined}
                value={search.role ?? 'any'}
                onValueChange={(value) => {
                  apply({
                    role:
                      value === 'admin'
                        ? 'admin'
                        : value === 'curator'
                          ? 'curator'
                          : undefined,
                    status: undefined,
                  })
                }}
                options={ROLE_OPTIONS.map((option) => ({ ...option }))}
              />
              <SimpleSelect
                size="sm"
                className="w-36"
                ariaLabel="Filter by account status"
                disabled={search.role !== undefined}
                value={search.status ?? 'any'}
                onValueChange={(value) => {
                  apply({
                    status:
                      value === 'active'
                        ? 'active'
                        : value === 'suspended'
                          ? 'suspended'
                          : undefined,
                    role: undefined,
                  })
                }}
                options={STATUS_OPTIONS.map((option) => ({ ...option }))}
              />
              {filtered ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    apply({ q: undefined, role: undefined, status: undefined })
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
              <p className="w-full text-caption text-ink-3 sm:w-auto sm:pl-1">
                Narrow by role or by status — one at a time.
              </p>
            </div>
          </div>
        }
        footer={
          data.total > CONSOLE_USERS_PAGE_SIZE ? (
            <>
              <Pagination
                className="hidden sm:flex"
                size="sm"
                page={data.page}
                pageCount={pageCount}
                pageSize={CONSOLE_USERS_PAGE_SIZE}
                totalItems={data.total}
                showEdges
                onPageChange={(next) => {
                  void navigate({
                    search: { ...search, page: next === 1 ? undefined : next },
                  })
                }}
              />
              <Pagination
                className="sm:hidden"
                size="sm"
                compact
                page={data.page}
                pageCount={pageCount}
                onPageChange={(next) => {
                  void navigate({
                    search: { ...search, page: next === 1 ? undefined : next },
                  })
                }}
              />
            </>
          ) : undefined
        }
      >
        {data.users.length === 0 ? (
          <div className="p-5">
            <EmptyState
              variant="filled"
              icon={<SearchX />}
              title="Nothing matches those filters"
              description="No account on the platform answers this search. Widen it, or clear the filters to see everybody."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  shape="pill"
                  onClick={() => {
                    apply({ q: undefined, role: undefined, status: undefined })
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <UsersTable
              users={data.users}
              selfId={shell.session.user.id}
              directionOf={directionOf}
              onSort={sortBy}
              onChanged={refresh}
            />
            <UsersCards
              users={data.users}
              selfId={shell.session.user.id}
              onChanged={refresh}
            />
          </>
        )}
      </Panel>
    </div>
  )
}

interface TableProps {
  readonly users: ReadonlyArray<ConsoleUser>
  readonly selfId: string
  readonly directionOf: (
    field: 'createdAt' | 'updatedAt' | 'name' | 'email',
  ) => 'asc' | 'desc' | null
  readonly onSort: (
    field: 'createdAt' | 'updatedAt' | 'name' | 'email',
  ) => void
  readonly onChanged: () => Promise<void>
}

const ACCOUNT_LINK_CLASS = cn(
  'rounded-sm underline decoration-transparent underline-offset-4 focus-ring',
  'transition-[text-decoration-color] duration-base ease-out-quint hover:decoration-ink-4',
)

/** The wide layout. Hidden below `md`, where {@link UsersCards} takes over. */
function UsersTable({
  users,
  selfId,
  directionOf,
  onSort,
  onChanged,
}: TableProps) {
  return (
    <div className="hidden md:block">
      <Table label="Platform accounts" fixed>
        <TableHeader>
          <TableRow>
            <TableHead
              sortable
              sortDirection={directionOf('name')}
              onSort={() => {
                onSort('name')
              }}
            >
              Account
            </TableHead>
            <TableHead
              className="hidden w-[26%] lg:table-cell"
              sortable
              sortDirection={directionOf('email')}
              onSort={() => {
                onSort('email')
              }}
            >
              Email
            </TableHead>
            <TableHead className="w-30">Platform role</TableHead>
            <TableHead className="w-32">Status</TableHead>
            <TableHead
              className="w-30"
              sortable
              sortDirection={directionOf('createdAt')}
              onSort={() => {
                onSort('createdAt')
              }}
            >
              Joined
            </TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((account) => (
            <TableRow key={account.id}>
              <TableCell truncate>
                <span className="flex min-w-0 items-center gap-3">
                  <AccountIdentity
                    emailClassName="lg:hidden"
                    name={account.name}
                    email={account.email}
                    image={account.image}
                    emailVerified={account.emailVerified}
                    self={account.id === selfId}
                    nameAs={(label) => (
                      <Link
                        to="/console/users/$userId"
                        params={{ userId: account.id }}
                        className={ACCOUNT_LINK_CLASS}
                      >
                        {label}
                      </Link>
                    )}
                  />
                </span>
              </TableCell>
              <TableCell truncate className="hidden lg:table-cell">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate">{account.email}</span>
                  <VerificationMark verified={account.emailVerified} />
                </span>
              </TableCell>
              <TableCell>
                <PlatformRoleBadge
                  role={displayPlatformRole(account.role)}
                  size="sm"
                />
              </TableCell>
              <TableCell>
                <AccountStatus
                  banned={account.banned}
                  banExpiresAt={account.banExpiresAt}
                />
              </TableCell>
              <TableCell muted className="tabular-nums">
                {formatDate(account.createdAt) ?? '—'}
              </TableCell>
              <TableCell className="pr-1 text-right">
                <UserActions
                  user={account}
                  self={account.id === selfId}
                  onChanged={onChanged}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * The narrow layout: one card per account rather than a table squeezed sideways.
 *
 * A six-column table at 360px is either a horizontal scroll nobody finds or four unreadable columns.
 * The card keeps the same facts in the same order — who, standing, status, when — and puts the
 * action menu where a thumb is.
 */
function UsersCards({
  users,
  selfId,
  onChanged,
}: {
  readonly users: ReadonlyArray<ConsoleUser>
  readonly selfId: string
  readonly onChanged: () => Promise<void>
}) {
  return (
    <ul className="flex flex-col md:hidden">
      {users.map((account) => (
        <li
          key={account.id}
          className="flex flex-col gap-3 px-4 py-4 not-last:border-b not-last:border-edge-faint"
        >
          <div className="flex items-start gap-3">
            <AccountIdentity
              className="min-w-0 flex-1"
              name={account.name}
              email={account.email}
              image={account.image}
              emailVerified={account.emailVerified}
              self={account.id === selfId}
              nameAs={(label) => (
                <Link
                  to="/console/users/$userId"
                  params={{ userId: account.id }}
                  className={ACCOUNT_LINK_CLASS}
                >
                  {label}
                </Link>
              )}
            />
            <UserActions
              user={account}
              self={account.id === selfId}
              onChanged={onChanged}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <PlatformRoleBadge
              role={displayPlatformRole(account.role)}
              size="sm"
            />
            <AccountStatus
              banned={account.banned}
              banExpiresAt={account.banExpiresAt}
            />
            <span className="ml-auto text-caption tabular-nums text-ink-4">
              Joined {formatDate(account.createdAt) ?? '—'}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * The loading state, sized to the rows it replaces and standing on `--color-surface-2`.
 *
 * The recessed ground is what separates it from a table that has finished loading: a skeleton on the
 * same white as the real card reads as content that has gone missing rather than as content on its
 * way.
 */
function UsersPending() {
  return (
    <div className="flex flex-col gap-6">
      <Card padding="none" className="overflow-hidden bg-surface-2">
        <div className="flex items-center gap-3 border-b border-edge-faint px-5 py-4">
          <Users aria-hidden className="size-4 text-ink-4" />
          <span className="text-micro font-semibold uppercase tracking-label text-ink-3">
            Accounts
          </span>
          <span className="sr-only">Loading accounts</span>
        </div>
        <RowsSkeleton rows={8} />
      </Card>
    </div>
  )
}
