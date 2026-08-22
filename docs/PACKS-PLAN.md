# Pakiety miejsc: role platformowe, katalog, scraping, MCP i treści publiczne

## Kontekst

planned.travel to własna implementacja (clean-room) funkcjonalności TREK, na Cloudflare Workers,
TanStack Start, D1 + Drizzle. Po wydaniu produkcyjnym oprócz subskrypcji chcemy sprzedawać
**pakiety miejsc** - kuratorowane kolekcje pól kempingowych i miejsc postojowych dla kamperów,
z których użytkownik planuje podróż.

Żeby taki pakiet powstał i dał się sprzedać, brakuje w repo czterech rzeczy:

1. **ról platformowych i zarządzania użytkownikami** - dziś jedyna rola to rola w organizacji
   (`member.role`), a `isAdmin` w `src/routes/_app/-server/shell.ts:129` znaczy „admin tego
   workspace'u", nie „administrator platformy";
2. **globalnego katalogu miejsc** (ponadtenantowego) - `places` i `collection_places` są zawsze
   przypisane do organizacji i wyjazdu;
3. **automatycznego pozyskiwania danych** ze źródeł zewnętrznych przez Firecrawl, z kolejką,
   cronem i akceptacją kuratora, oraz serwera MCP, żeby człowiek i agent pracowali na tym samym
   katalogu;
4. **powierzchni publicznej** - `share_links` istnieje w schemacie i w `src/server/repos/trips.ts`,
   ale **żadna trasa jej nie konsumuje**. Nie da się dziś pokazać niezalogowanemu nic poza
   landingiem i cennikiem, a publiczna atlas map i publiczna strona pakietu są warunkiem sprzedaży.

Do tego decyzja o zastąpieniu Stripe'a przez Polar.sh, warunek wstępny dla płatnych pakietów.

## Decyzje przyjęte

| Obszar | Decyzja |
|---|---|
| Billing | Polar.sh **zastępuje** Stripe - subskrypcje i pakiety u jednego dostawcy |
| Źródła danych | Scrapujemy wszystkie trzy serwisy; provenance zapisywana przy każdym rekordzie |
| MCP | Własna implementacja JSON-RPC 2.0 / Streamable HTTP, bez nowych zależności |
| Role i administracja | Plugin `admin` Better Auth + konsola platformy `/_app/console` |
| Treści publiczne | Uogólnione `share_links` + publiczne strony pakietów, moderowane z konsoli |

**Ryzyko prawne (odnotowane, zaakceptowane).** Pobieranie istotnej części cudzej bazy i jej
odsprzedaż jest sporne w świetle prawa sui generis (ustawa o ochronie baz danych) i regulaminów
tych serwisów. Plan minimalizuje ekspozycję technicznie: importujemy **fakty** (nazwa, współrzędne,
udogodnienia, kontakt), nigdy cudzych opisów ani zdjęć; każdy rekord niesie `source_url`,
`source_name`, `licence`, `attribution` i wymaga akceptacji kuratora przed publikacją. Zmiana
polityki nie wymaga zmiany schematu - wystarczy wyłączyć adapter w `catalog_sources`.

## Zamrożenie zależności - jak je uszanować

`docs/SPEC.md` §3 zabrania `pnpm add`. Zweryfikowane w `node_modules`:

- **Plugin `admin` jest częścią `better-auth@1.7.1`** - `better-auth/plugins` eksportuje go obok
  używanych już `organization` i `twoFactor`, a `better-auth/plugins/access` daje `createAccessControl`.
  Zero nowych paczek.
- **Polar** - REST przez `fetch` (`https://api.polar.sh/v1`, sandbox `https://sandbox-api.polar.sh/v1`),
  webhooki weryfikowane HMAC-SHA256 na WebCrypto. Bez `@polar-sh/sdk`.
- **Firecrawl** - REST przez `fetch` (`https://api.firecrawl.dev/v2/...`). Bez SDK.
- **MCP** - własny JSON-RPC. Bez `@modelcontextprotocol/sdk` i `agents`.
- **Wyjątek nazwany, przyznany przez użytkownika: React Email** (`@react-email/components`, `react-email`).
  `docs/SPEC.md` §3 zapisuje go jako wyjątek wąski i wymieniony z nazwy - reszta zestawu pozostaje
  zamrożona, a każda kolejna paczka to nadal finding, nie `pnpm add`. Instalacja należy do Fazy A;
  Faza 0 tylko odnotowuje wyjątek w kontrakcie.
- Paczka `stripe` **zostaje** w `package.json` mimo usunięcia kodu, który jej używa. Usunięcie
  wpisu łamie zamrożenie - agent zgłasza to jako finding, nie robi samodzielnie.

Podczas implementacji agent **weryfikuje kontrakty w dokumentacji** (Polar: nazwy zdarzeń webhooka
i nagłówki podpisu; Firecrawl: kształt `formats`/`json`/`webhook`; Better Auth: opcje `admin()`),
zamiast opierać się na pamięci. W sesji dostępne są `mcp__firecrawl__*` - użyj ich do rozpoznania
trzech źródeł **przed** napisaniem adapterów.

---

## Faza 0 - kontrakt dokumentów

Ultrabuild czyta `docs/SPEC.md`, `DESIGN.md`, `ARCHITECTURE.md`, `DEPLOY.md` jako definicję
gotowości. Kontrakt musi opisywać nowy stan, zanim ruszy budowanie.

- `docs/SPEC.md` - §3 `Billing: Polar.sh`; §5 role platformowe, nowe bindingi i cron; §6 nowe
  katalogi (`src/server/catalog/**`, `src/server/mcp/**`, `src/server/public/**`).
- `docs/CATALOG.md` (**nowy**) - model katalogu, słownik pól, polityka provenance, reguły dedupu,
  cykl życia rekordu (`ingested → review → published → retired`), kontrakt narzędzi MCP.
- `docs/ACCESS.md` (**nowy**) - macierz ról i uprawnień (statements Better Auth), co widzi
  niezalogowany, co kurator, co administrator; zasady audytu i impersonacji.
- `docs/DEPLOY.md` - runbook Polara, `FIRECRAWL_API_KEY`, wydawanie tokenów MCP, nadanie pierwszej
  roli `admin`, nowy cron.
- `.dev.vars.example` - `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER`,
  `FIRECRAWL_API_KEY`, `FIRECRAWL_WEBHOOK_SECRET`, `MCP_TOKEN_PEPPER`; usunięcie `STRIPE_*`;
  `VITE_STRIPE_PRICE_*` → `VITE_POLAR_PRODUCT_*`.
- `.claude/ultrabuild/run.json` → `contractPaths` rozszerzone o `docs/CATALOG.md` i `docs/ACCESS.md`.

---

## Faza A - migracja billingu na Polar.sh

Warunek wstępny Fazy G. **Stripe znika z repozytorium w tej fazie** - nie zostaje jako martwy kod
„do sprzątnięcia później", bo późniejsze fazy budowałyby wtedy na mylnym założeniu, że jeszcze
gdzieś żyje. Decyzja użytkownika z 22.08: jesteśmy na etapie build, więc zmieniamy wszystko naraz.

**Zakres pełny** - lista poniżej była w pierwszej wersji planu niekompletna i audyt to wykazał:
`src/server/billing/**`, `src/lib/plans.ts`, `src/routes/api/polar/**`,
`src/routes/_app/settings/billing.tsx`, `src/routes/pricing.tsx`, `src/routes/legal/terms.tsx`,
`src/server/db/schema.ts`, `drizzle/`, `src/server/repos/billing.ts`, `src/server/queue/types.ts`,
`src/routes/api/dev/-seed/dataset/**`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`,
`package.json` + `pnpm-lock.yaml` (wyjątek nazwany), `.dev.vars.example`. `src/routeTree.gen.ts`
**regenerowany** przez `pnpm generate-routes`, nigdy ręcznie.

### Zweryfikowane fakty, którymi ta faza się kieruje

Sprawdzone na żywym OpenAPI Polara (`info.version` 2026-04) i w sandboxie DESIGN4PRO - **nie
z pamięci**, bo pierwsza wersja tego planu miała tu cztery błędy:

| Twierdzenie z pierwszej wersji planu | Jak jest naprawdę |
|---|---|
| `POST /v1/checkout-sessions` | nie istnieje; są `POST /v1/checkouts/` i `POST /v1/customer-sessions/` |
| `incomplete*` nie istnieje w Polarze, zawęź krotkę | **istnieje**; osiem wartości Polara = osiem w `plans.ts:32-41`, **nie ruszamy krotki** |
| `subscription.cycled\|paused\|resumed` nie istnieją | **istnieją**; enum ma 41 wartości. Okrojoną listę 35 niesie schemat narzędzia MCP, nie API |
| rename kolumn to osobna decyzja | rename **robimy**, razem z usunięciem Stripe'a |

### Produkty w sandboxie - już utworzone

Organizacja DESIGN4PRO (`0cad0d45-3b92-4144-ad4c-1438ec9cd6d3`), cztery produkty gotowe,
identyfikatory w `.env.local` (plik ignorowany przez git):

| plan | interwał | kształt ceny | kwota |
|---|---|---|---|
| Solo | monthly | fixed | 900 |
| Solo | yearly | fixed | 9000 |
| Crew | monthly | **seat_based**, volume, 2-10 miejsc | 700 za miejsce |
| Crew | yearly | **seat_based**, volume, 2-10 miejsc | 7000 za miejsce |

Wszystkie z `trial_interval: day` × 14, zgodnie z `trialDays: 14` w `plans.ts`. Każdy produkt niesie
cenę w EUR **i** USD, bo Polar wymaga obecności domyślnej waluty prezentacyjnej organizacji (EUR),
a nasz katalog jest w USD. Kwoty są równe nominalnie (9 EUR = 9 USD), nie przeliczone kursem -
**do potwierdzenia przed produkcją**.

### Crew jest seat-based i to musi przetrwać migrację

Faza 0 przegapiła to w całości: słowo „seat" nie padło ani razu w SPEC, DEPLOY, CATALOG ani w tym
planie, podczas gdy `src/lib/plans.ts:306` ma `seatBased: true`, `seatRange {min: 2, max: 10}`,
`perSeat: true`, a `checkout.ts:251` wysyła `quantity: selection.seats` z `adjustable_quantity`.
Polar odwzorowuje to niemal 1:1: `seats` / `min_seats` / `max_seats` w `POST /v1/checkouts/`.
`clampSeats` i `seatRange` zostają bez zmian. Gdyby produkty powstały jako `fixed`, Crew po cichu
policzyłby 7 USD za dziesięć osób - dlatego produkty utworzono jako `seat_based` od razu.

### Praca do wykonania

- `src/server/billing/stripe.ts` → **`polar.ts`**: cienki klient `fetch` (base URL wg `POLAR_SERVER`,
  `Authorization: Bearer`, retry 2×, timeout 20 s) + `verifyWebhookSignature()` na WebCrypto.
  Brak sekretu → `BillingConfigError`, jak dziś.
- `checkout.ts` - `createCheckoutSession()` na `POST /v1/checkouts/` (`products` jako tablica UUID,
  `external_customer_id` = `organizationId`, `seats` dla Crew), `createPortalSession()` na
  `POST /v1/customer-sessions/`. Produkt **zawsze** rozwiązywany po stronie serwera z
  `src/lib/plans.ts` - reguła zostaje.
- `webhook.ts` - zdarzenia `subscription.created|active|updated|canceled|uncanceled|cycled|past_due|revoked|paused|resumed`,
  `order.created|updated|paid|refunded`, `checkout.created|updated|expired`. Zachowaj architekturę:
  weryfikacja podpisu → claim `event_id` w KV (idempotencja) → mały zapis do D1 inline → reszta na
  `TASKS`. `subscription.cycled` jest sygnałem odnowienia.
- `mapping.ts` - statusy Polara na `SUBSCRIPTION_STATUSES` **jeden do jednego**. Krotki nie ruszamy.
- `types.ts`, `store.ts`, `schema.ts`, `repos/billing.ts`, `queue/types.ts` -
  `stripeCustomerId` → `providerCustomerId`, `stripeSubscriptionId` → `providerSubscriptionId`,
  `stripePriceId` → `providerProductId`, plus te same nazwy kolumn w tabeli `subscriptions`
  i w dwóch indeksach.
- **Migracja Drizzle**: `pnpm db:generate` po zmianie nazw kolumn (`schema.ts:269`). Tabela jest
  pusta przed produkcją, więc rename bez backfillu. `drizzle-kit` pyta interaktywnie przy renamie -
  sprawdź wygenerowany SQL, zanim go zacommitujesz.
- `src/lib/plans.ts` - `PlanPrice.priceId` → `productId`, `PRICE_IDS` → `PRODUCT_IDS`
  z `import.meta.env.VITE_POLAR_PRODUCT_*`.
- `src/routes/api/stripe/webhook.ts` → `src/routes/api/polar/webhook.ts`, potem
  `pnpm generate-routes`.
- **Usunięcie Stripe'a**: `pnpm remove stripe`, zero importów wartościowych i typowych, zero
  `STRIPE_*` w `.dev.vars.example` i w obu workflow'ach CI. Kryterium: `grep -ril stripe src/`
  zwraca pustkę.
- **React Email**: `pnpm add @react-email/components` (dependencies) + `pnpm add -D react-email`
  (devDependencies), przepisanie `src/server/auth/email.ts` na komponenty i cztery szablony
  billingowe - potwierdzenie subskrypcji, zmiana planu, nieudana płatność, zakup pakietu. Każdy
  zachowuje wersję tekstową.
- `src/routes/legal/terms.tsx` i `src/routes/pricing.tsx` - ta sama poprawka Merchant-of-Record co
  w `billing.tsx`; wszystkie trzy ruszają zacommitowane baseline'y, więc jeden właściciel.
- `src/server/billing/__tests__/**` - fake'i Polara zamiast Stripe'a; zachowaj przypadki:
  redelivery, drift zegara, brak sekretu, dunning. **Dołóż zaszyty wektor Standard Webhooks**
  (sekret + surowe ciało + trzy nagłówki + podpis policzony niezależnie): dziś obie strony testu
  podpisu to SDK Stripe'a, a po migracji obie stają się naszym kodem i bez wektora dziewięć testów
  przestaje czegokolwiek dowodzić.

### Kształt rundy

Sześć itemów, własność rysowana tak, żeby pliki, które muszą się zgadzać, miały jednego
właściciela, a testy należały do właściciela kodu, który testują: **(1)** katalog produktów -
`plans.ts` + oba workflow'y CI + `.dev.vars.example`; **(2)** `polar.ts`; **(3)** `checkout.ts` +
`types.ts` + `mapping.ts` + testy; **(4)** `webhook.ts` + przeniesienie trasy + `harness.ts`
i `webhook.test.ts`; **(5)** React Email + cztery szablony; **(6)** powierzchnie widoczne -
`billing.tsx`, `pricing.tsx`, `terms.tsx`.

Gate mechaniczny: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm generate-routes && git diff
--exit-code -- src/routeTree.gen.ts`, `pnpm build`, oraz Playwright **wyłącznie** z jawnym
`PLAYWRIGHT_BASE_URL` na porcie z przedziału 3010-3020, który runda sama zbindowała i ubija po
sobie. Weryfikacja wizualna w trakcie rundy przez Ego Lite, nie przez Playwrighta.

### Akceptacja Fazy A - matryca w sandboxie Polara

Każdy wiersz przechodzony ręcznie w sandboxie i pokryty testem tam, gdzie da się to zrobić bez sieci:

| # | Scenariusz | Oczekiwany wynik |
|---|---|---|
| 1 | Subskrypcja Solo, miesięcznie i rocznie | checkout → webhook → wiersz w `subscriptions` → moduły odblokowane |
| 2 | Podwyższenie Solo → Crew | proracja po stronie Polara, uprawnienia zmieniają się natychmiast |
| 3 | Obniżenie Crew → Solo | zmiana na koniec okresu, uprawnienia trzymają do `current_period_end` |
| 4 | Anulowanie | `cancel_at_period_end`, dostęp do końca okresu, potem Free |
| 5 | Wznowienie przed końcem okresu | subskrypcja wraca, bez nowego checkoutu |
| 6 | Nieudana płatność | `past_due` utrzymuje dostęp (dunning), `unpaid` odcina |
| 7 | Faktury | read-only lista zamówień w `/settings/billing` (Orders API) + pobranie PDF |
| 8 | Portal klienta | „Zarządzaj płatnościami" → `customer-sessions` → edycja danych faktury i metody płatności |

`docs/DEPLOY.md` niesie setup każdego wiersza: produkty, ceny, karty testowe.

### Faktury i dane do faktury - czego świadomie nie budujemy

Zweryfikowane w dokumentacji Polara: Polar jest **Merchant of Record** - rozlicza VAT/GST w ponad stu
rynkach, przejmuje zwroty i chargebacki, i **generuje PDF faktury do każdego opłaconego zamówienia**.
Klient sam edytuje swoją fakturę - nazwa firmy, NIP, adres - w hostowanym **Customer Portal**; po
wygenerowaniu faktury dane są zamrożone i korekta idzie tą samą drogą. Dane rozliczeniowe siedzą też
na zamówieniu i są edytowalne przez Orders API do momentu wygenerowania faktury.

Dlatego **nie projektujemy własnego formularza danych do faktury**. Duplikowałby zgodną podatkowo
powierzchnię hostowaną przez dostawcę i brał na nas odpowiedzialność VAT, której inaczej nie mamy.
Nasza powierzchnia to: akcja „Zarządzaj płatnościami" mintująca sesję klienta i przekierowująca do
portalu, plus opcjonalna read-only lista zamówień z linkami do PDF.

### Maile transakcyjne

Resend jest **już podłączony**: [src/server/queue/handlers/email.ts](src/server/queue/handlers/email.ts)
POST-uje na `https://api.resend.com/emails` z `EMAIL_API_KEY`, a zmienna jest już w
`.dev.vars.example`. Nie ma czego integrować - brakuje wyłącznie realnej wartości w lokalnym
`.dev.vars`.

Faza A instaluje React Email (wyjątek wyżej), przepisuje istniejące szablony z
[src/server/auth/email.ts](src/server/auth/email.ts) na komponenty i dokłada szablony billingowe:
potwierdzenie subskrypcji, zmiana planu, nieudana płatność, zakup pakietu. Każdy szablon zachowuje
wersję tekstową - klienci pocztowe bez HTML nie mogą dostać pustej wiadomości.

---

## Faza B - role platformowe i zarządzanie użytkownikami (Better Auth `admin`)

To fundament dla wszystkiego dalej: kurator katalogu, moderator treści publicznych i token MCP
sięgają po ten sam model uprawnień.

### Konfiguracja

`src/server/auth/access.ts` (**nowy**, izomorficzny słownik uprawnień):

```ts
const statement = {
  ...defaultStatements,                       // user: [...], session: [...]
  catalog: ['read', 'write', 'publish'],
  pack:    ['read', 'write', 'publish'],
  source:  ['read', 'run'],
  share:   ['read', 'revoke'],
} as const
```

Role: `admin` (wszystko), `curator` (catalog/pack/source/share, **bez** `user` i `session`),
`user` (nic platformowego, rola domyślna).

`src/server/auth/index.ts` - dołóż `admin({ ac, roles, adminRoles: ['admin'], defaultRole: 'user' })`
do listy pluginów obok `organization` i `twoFactor`.

`src/server/db/auth-schema.ts` - kolumny wymagane przez plugin: `user.role`, `user.banned`,
`user.ban_reason`, `user.ban_expires`, `session.impersonated_by`. Indeks na `user.role`.

`src/components/layout/session.ts` + `src/routes/_app/-server/shell.ts` - do sesji dochodzi
`platformRole` i pochodne `isPlatformAdmin` / `isCurator`. Istniejące `isAdmin` **zostaje**
rolą w organizacji - nie zmieniaj jego znaczenia, dołóż obok.

`src/server/auth/guard.ts` (**nowy**) - `requirePermission(session, { catalog: ['write'] })`,
jedna funkcja używana przez funkcje serwerowe konsoli **i** przez MCP, żeby nie było dwóch
niezależnych implementacji autoryzacji.

### Audyt

`platform_audit_log` (**nowa tabela globalna**, `schema.ts`): `actor_user_id`, `actor_kind`
(`human` / `agent` / `system`), `action`, `entity_type`, `entity_id`, `changes` (JSON before/after),
`ip`, `user_agent`, `created_at`. Zastępuje osobną tabelę rewizji katalogu - oś czasu miejsca to
zapytanie po `entity_type = 'catalog_place'`. Istniejący `audit_log` jest tenantowy i zostaje bez zmian.

Zapis wymuszony w `requirePermission`-owanych mutacjach; **impersonacja i ban zawsze audytowane**.

### Konsola `/_app/console`

Nowa gałąź tras, oddzielona od istniejącego `/_app/admin` (który pozostaje panelem workspace'u).
Wejście widoczne w `src/components/layout/user-menu.tsx` tylko dla ról platformowych.

- `console/route.tsx` - guard `requirePermission`, wspólna nawigacja `PillNav`.
- `console/index.tsx` - przegląd: użytkownicy, katalog wg statusu, ostatnie przebiegi scrapingu,
  ostatnie wpisy audytu.
- `console/users.tsx` - tabela użytkowników (szukanie, filtr po roli i statusie bana,
  wirtualizacja `@tanstack/react-virtual`), akcje: zmiana roli, ban/unban z powodem i terminem,
  wygaszenie sesji, reset hasła, utworzenie konta, impersonacja.
- `console/users.$userId.tsx` - karta użytkownika: organizacje i role w nich, sesje, historia
  audytu, subskrypcja.
- Impersonacja: trwały pasek ostrzegawczy na całej aplikacji, gdy `session.impersonatedBy` jest
  ustawione, z akcją „zakończ". Bez tego funkcja jest niebezpieczna.

Wszystkie akcje idą przez `src/server/fns/console/*` opakowujące endpointy `/api/auth/admin/*`
klientem Better Auth, nigdy bezpośrednim `fetch` z komponentu.

---

## Faza C - katalog miejsc i panel kuratora

### Model danych (`src/server/db/schema.ts`, nowa sekcja "Catalogue")

Tabele **globalne** (bez `organization_id` - to treść platformy, nie tenanta):

| Tabela | Rola |
|---|---|
| `catalog_sources` | źródło (`slug`, `name`, `homepage`, `adapter`, `enabled`, `licence_note`, `last_run_at`) |
| `catalog_runs` | przebieg scrapingu (`source_id`, `status`, liczniki `discovered/created/updated/failed`, `error`, czasy) |
| `catalog_ingest` | surowy rekord (`run_id`, `source_id`, `external_id`, `source_url`, `payload` JSON, `checksum`, `status` `pending/promoted/rejected/duplicate`, `matched_place_id`) |
| `catalog_places` | rekord katalogu - patrz niżej |
| `catalog_place_sources` | N:N miejsce ↔ źródło (`external_id`, `source_url`, `last_seen_at`) - jedno miejsce bywa w kilku serwisach |
| `place_packs` | pakiet (`slug`, `name`, `description`, `cover_image_url`, `country_codes`, `status` `draft/published/retired`, `price_minor`, `currency`, `polar_product_id`, `place_count`, `published_at`) |
| `place_pack_places` | N:N pakiet ↔ miejsce (`sort_order`) |
| `staff_api_tokens` | tokeny MCP (`user_id`, `name`, `token_hash`, `last_used_at`, `expires_at`, `revoked_at`) - uprawnienia biorą się z roli właściciela, nie z osobnych scope'ów |

Tabela **tenantowa**: `pack_entitlements` (`organization_id`, `pack_id`, `polar_order_id`,
`granted_at`, `revoked_at`).

`catalog_places`: `id`, `kind` (`campsite` / `motorhome_stopover` / `wild_camping` / `service_point`),
`name`, `slug`, `summary` (**własny tekst kuratora**), `...geo()`, `address`, `city`, `region`,
`country_code`, `website`, `phone`, `email`, `amenities` (JSON, słownik zamknięty),
`season_from`/`season_to`, `price_minor`, `currency`, `capacity`, `status`
(`ingested/review/published/retired`), `licence`, `attribution`, `dedupe_key`, `verified_at`,
`verified_by`, `...timestamps()`.

Konwencje z nagłówka `schema.ts`: `pk()`, `timestamps()`, `enumCheck()`, `latLngChecks()`,
`minor()`, indeks na każdym FK i każdej kolumnie filtrowanej. `dedupe_key` = geohash ~100 m +
znormalizowana nazwa, z `uniqueIndex`. Dodatkowo `PLACE_SOURCES` (`schema.ts:159`) rozszerzone
o `'catalog'`.

### Warstwa dostępu

`src/server/repos/base.ts` wymusza filtr tenanta - katalog jest globalny, więc **nie** wolno go
tam wcisnąć. Nowy `src/server/catalog/repo.ts` z jawnym strażnikiem: każda mutacja przyjmuje
`PlatformActor` (`{ userId, actorKind, role }`), przechodzi przez `requirePermission` i sama
dopisuje wpis do `platform_audit_log`. `pack_entitlements` zostaje w `src/server/repos/packs.ts`
na istniejącym `createTenantRepository()` - to dane tenanta.

### Panel kuratora (w konsoli z Fazy B)

- `console/places.tsx` - tabela z filtrami (status, kraj, rodzaj, źródło, tekst), wirtualizacja,
  akcje masowe (publikuj / cofnij / przypisz do pakietu), podgląd MapLibre obok listy.
- `console/places.$placeId.tsx` - edycja pełnego rekordu (TanStack Form + Zod), blok provenance
  (wszystkie źródła, `source_url`, licencja), oś czasu z `platform_audit_log`.
- `console/ingest.tsx` - kolejka akceptacji: surowy payload obok proponowanego rekordu
  z podświetleniem różnic, akcje `promote` / `merge into existing` / `reject`.
- `console/packs.tsx`, `console/packs.$packId.tsx` - CRUD pakietów, kolejność `@dnd-kit`,
  publikacja walidująca: ≥1 miejsce, wszystkie `published`, ustawiony `polar_product_id`.
- `console/sources.tsx` - źródła, włącz/wyłącz, „uruchom teraz", historia przebiegów.

Komponenty produktowe w `src/components/console/**`, wyłącznie na prymitywach z
`src/components/ui`. Zero nowych tokenów poza `src/styles/tokens.css`.

---

## Faza D - pipeline scrapingu (Firecrawl)

```
Cron (0 4 * * 1)  ─┐
                   ├→ TASKS: catalog.scrape.start (per aktywne źródło)
Konsola „uruchom" ─┘        │
                            ├→ adapter: Firecrawl map/crawl/scrape → catalog_ingest (surowe)
                            └→ TASKS: catalog.ingest.match
                                      ├→ dedup (dedupe_key + promień 150 m + podobieństwo nazwy)
                                      ├→ dopasowane → catalog_place_sources, last_seen_at
                                      └→ nowe       → catalog_places status `ingested`
                                                       → kolejka akceptacji w /console/ingest
```

Nic nie trafia do sprzedaży automatycznie - publikacja jest zawsze decyzją człowieka albo agenta
z tokenem MCP i rolą `curator`.

- `src/server/catalog/firecrawl.ts` - klient `fetch`: `map`, `crawl`, `scrape` z ekstrakcją JSON
  wg schematu Zod, obsługa `202 + job id`. Odbiór wyników **webhookiem**
  (`src/routes/api/firecrawl/webhook.ts`, podpis HMAC) z fallbackiem na polling przez
  `retry({ delaySeconds })` na kolejce - Worker nie może czekać na długi crawl.
- `src/server/catalog/adapters/` - jeden plik na źródło, wspólny interfejs
  `{ slug, discover(ctx), extract(ctx, url) }` zwracający zwalidowany `IngestRecord`:
  - `grupa-biwakowa.ts`, `camper-system.ts` - **najpierw sprawdź, czy mapa nie pobiera gotowego
    GeoJSON/JSON z własnego endpointu** (`mcp__firecrawl__firecrawl_interact` + podgląd network).
    Natywny feed jest stabilniejszy i tańszy niż parsowanie HTML; scrape to fallback.
  - `stayfree.ts` - `firecrawl_map` po `/campspots/` → `scrape` stron szczegółowych ze schematem JSON.
  - Każdy adapter: limit stron na przebieg, `robots.txt`, `User-Agent` identyfikujący
    planned.travel, throttling, przerwanie po N błędach z rzędu.
- `src/server/queue/types.ts` - nowe `TASK_KINDS`: `catalog.scrape.start`, `catalog.scrape.page`,
  `catalog.ingest.match` + schematy Zod (istniejący wzorzec dyskryminowanej unii).
- `src/server/queue/consumer.ts` + `src/server/queue/handlers/` - handlery nowych rodzajów.
- `src/server/worker.ts` - nowy cron `0 4 * * 1` w `switch (controller.cron)` oraz wpis
  w `wrangler.jsonc → triggers.crons`.
- `wrangler.jsonc` - `vars`: `FIRECRAWL_API_URL`, `CATALOG_SCRAPE_MAX_PAGES`.

Testy `src/server/catalog/__tests__/`: dedup (ta sama lokalizacja w dwóch serwisach → jeden rekord,
dwa wpisy w `catalog_place_sources`), idempotencja (ten sam `checksum` dwa razy → brak zmian),
normalizacja adapterów na utrwalonych fixture'ach, odrzucenie rekordu bez współrzędnych.

---

## Faza E - serwer MCP

`src/server/mcp/` + trasa `src/routes/api/mcp.ts`.

- **Transport**: Streamable HTTP. `POST /api/mcp` przyjmuje JSON-RPC 2.0 (obiekt lub batch),
  odpowiada `application/json`; `GET` → 405. Nie wystawiamy SSE - narzędzia katalogu są
  synchroniczne, a to upraszcza cały serwer.
- **Metody**: `initialize`, `notifications/initialized`, `tools/list`, `tools/call`, `ping`.
- **Uwierzytelnianie**: `Authorization: Bearer <token>` → SHA-256 z `MCP_TOKEN_PEPPER` →
  `staff_api_tokens` → sprawdzenie `revoked_at`/`expires_at` → wczytanie roli właściciela →
  **ten sam `requirePermission` co w konsoli**. Brak tokenu → 401; brak uprawnienia → błąd
  JSON-RPC, nie 403.
- **Narzędzia** (schematy wejścia z Zod, każdy zapis dopisuje `platform_audit_log`
  z `actor_kind: 'agent'`):

  | Narzędzie | Działanie |
  |---|---|
  | `catalog_search_places` | filtry: tekst, kraj, rodzaj, status, bbox; kursor |
  | `catalog_get_place` | pełny rekord + provenance + historia |
  | `catalog_upsert_place` | tworzy/aktualizuje, wymusza `dedupe_key` |
  | `catalog_set_place_status` | `review` / `published` / `retired` |
  | `catalog_list_ingest` / `catalog_promote_ingest` | kolejka surowych rekordów, promocja lub scalenie |
  | `packs_list` / `packs_create` / `packs_set_places` / `packs_publish` | zarządzanie pakietami |
  | `sources_list` / `sources_run` | podgląd źródeł i ręczne uruchomienie przebiegu |

- Limit 200 rekordów na odpowiedź, twarde odcięcie rozmiaru payloadu.
- Wydawanie i odwoływanie tokenów: `console/tokens.tsx` (tylko rola `admin`), token pokazywany raz.
- Testy: handshake, odrzucenie złego i wygasłego tokenu, `curator` bez prawa `user:*`,
  błąd walidacji jako `-32602`, wpis audytu przy każdej mutacji.
- `docs/CATALOG.md` - gotowy wpis konfiguracyjny dla Claude Code / Claude Desktop.

---

## Faza F - powierzchnia publiczna dla niezalogowanych

Dziś nic poza landingiem i cennikiem nie jest publiczne. Potrzebujemy trzech rzeczy naraz:
udostępnionego wyjazdu, udostępnionej atlas map i publicznej strony pakietu (bez niej nie ma czego
sprzedawać).

### Uogólnienie `share_links`

`share_links` (`schema.ts:1028`) ma dziś `trip_id NOT NULL`. Zmień na `resource_kind`
(`trip` / `atlas` / `collection`) + `resource_id`, z `enumCheck` i indeksem
`(resource_kind, resource_id)`. `ShareScopes` (`schema.ts:253`) rozszerz o wariant atlasowy
(`countries`, `stats`, `bucketList`). Tabela jest pusta przed produkcją - migracja bez backfillu.

### Trasy publiczne

- `src/routes/share.$token.tsx` - odczyt po tokenie, renderuje wyjazd albo atlas zależnie od
  `resource_kind`, wyłącznie w zakresie z `scopes`.
- `src/routes/packs.index.tsx` i `src/routes/packs.$slug.tsx` - publiczny katalog pakietów:
  opis, mapa poglądowa, próbka miejsc (limit, np. 10), atrybucja źródeł, CTA do zakupu.
  Pełna lista miejsc dopiero po zakupie.

### Bezpieczeństwo i wydajność

- `src/server/public/**` (**nowy moduł**) - jedyne miejsce, gdzie czytamy dane bez sesji.
  **Nigdy** nie wolno tu użyć repo tenantowego z podrobionym kontekstem: moduł ma własne,
  read-only projekcje z jawną białą listą kolumn, żeby wyciek pola był niewyrażalny.
- Odczyt cache'owany w KV z krótkim TTL i jawną inwalidacją przy zmianie zasobu, zgodnie
  z `docs/ARCHITECTURE.md` §4. D1 nie może być na ścieżce krytycznej stron anonimowych (SPEC §5).
- Rate limiting po tokenie i po IP; `view_count` i `last_viewed_at` aktualizowane
  asynchronicznie przez kolejkę, nie inline.
- `head` z `meta`/OG na trasach publicznych, `noindex` dla `/share/$token`, indeksowanie
  dozwolone dla `/packs/*`.

### Moderacja w konsoli

`console/public.tsx` - wszystkie aktywne udostępnienia (kto, co, kiedy, ile odsłon), odwołanie
jednym kliknięciem (uprawnienie `share:revoke`), lista opublikowanych pakietów z akcją wycofania.

---

## Faza G - sprzedaż pakietów i użycie w planerze

- Publiczny katalog pakietów czytany z D1 i cache'owany w KV; `polar_product_id` żyje w bazie,
  bo pakiety dodaje kurator w runtime, nie deploy.
- `src/server/billing/checkout.ts` - `createPackCheckout(packId)`: produkt jednorazowy Polara,
  `metadata: { packId, organizationId }`.
- `src/server/billing/webhook.ts` - `order.paid` z `metadata.packId` → wpis do `pack_entitlements`
  + inwalidacja cache uprawnień.
- `src/server/billing/entitlements.ts` - `resolvePackEntitlements(organizationId)` obok resolvera
  planu, ten sam wzorzec cache w KV.
- `src/routes/_app/packs.tsx` - pakiety posiadane i dostępne; `src/routes/pricing.tsx` - sekcja
  o pakietach.
- **Użycie**: nowe źródło w `src/components/modules/add-place-dialog.tsx` - wyszukiwarka po
  katalogu ograniczona do posiadanych pakietów; wybór **kopiuje** rekord do `places`
  z `source: 'catalog'`, `externalId: catalogPlaceId`. Kopia, nie referencja - wyjazd musi
  przeżyć wycofanie pakietu.
- Warstwa MapLibre z miejscami pakietu w planerze, zasilana tym samym repo katalogu.

---

## Kolejność i uruchomienie przez `/ultrabuild`

Ultrabuild trzyma jeden `run.json` naraz (slug), więc fazy uruchamiamy sekwencyjnie - każda po
zaakceptowaniu poprzedniej. Wewnątrz fazy ścieżki własności są rozłączne, więc agenci pracują
równolegle. Faza F może iść równolegle z E, jeśli zdecydujesz się prowadzić dwa worktree.

```bash
/ultrabuild Faza 0: zaktualizuj docs/SPEC.md, docs/DEPLOY.md i .dev.vars.example pod Polar.sh, role platformowe, katalog miejsc, MCP i treści publiczne; napisz docs/CATALOG.md i docs/ACCESS.md
```

```bash
/ultrabuild Faza A: zastąp Stripe przez Polar.sh i usuń Stripe z repo całkowicie - REST przez fetch, webhook HMAC na WebCrypto, Crew jako seat_based, rename kolumn stripe_* na provider_* z migracją, pnpm remove stripe, pnpm add @react-email/components i -D react-email z czterema szablonami billingowymi. Pracuj wg docs/PACKS-PLAN.md §Faza A - produkty w sandboxie już istnieją, ich id są w .env.local
```

```bash
/ultrabuild Faza B: włącz plugin admin Better Auth z rolami admin/curator/user, dodaj platform_audit_log i konsolę platformy /_app/console z zarządzaniem użytkownikami, banem i impersonacją
```

```bash
/ultrabuild Faza C: globalny katalog miejsc w D1 i panel kuratora w konsoli - lista, edycja z provenance, kolejka akceptacji i pakiety
```

```bash
/ultrabuild Faza D: pipeline scrapingu przez Firecrawl - adaptery grupabiwakowa.pl, campersystem.pl i stayfree.app, kolejka, cron, dedup i kolejka akceptacji
```

```bash
/ultrabuild Faza E: serwer MCP na /api/mcp - JSON-RPC 2.0 po Streamable HTTP, tokeny staff_api_tokens, wspólny requirePermission z konsolą
```

```bash
/ultrabuild Faza F: powierzchnia publiczna - uogólnione share_links dla wyjazdu i atlasu, publiczne strony pakietów, moduł src/server/public z cache w KV i moderacja w konsoli
```

```bash
/ultrabuild Faza G: sprzedaż pakietów przez Polar Checkout, uprawnienia pack_entitlements i użycie katalogu w planerze wyjazdu
```

Przed pierwszym uruchomieniem dopisz `docs/CATALOG.md` i `docs/ACCESS.md` do `contractPaths`
w `.claude/ultrabuild/run.json`.

---

## Weryfikacja

**Mechaniczna (każda faza, SPEC §7)**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

**Faza A** - Polar w sandboxie: checkout planu Solo → webhook → wiersz w `subscriptions` → moduły
odblokowane w `/settings/billing`. Powtórzone doręczenie zdarzenia nie zmienia stanu. Żądanie
z podmienionym `product_id` odrzucone.

**Faza B**
```bash
pnpm db:generate && pnpm db:migrate:local
```
- Konto z rolą `user` dostaje 403 na `/console` i na każdej funkcji serwerowej konsoli.
- `curator` widzi katalog, ale nie zakładkę użytkowników i nie może zmienić roli.
- Ban → natychmiastowe wylogowanie i komunikat przy próbie logowania.
- Impersonacja → pasek ostrzegawczy widoczny na każdym ekranie, wpis w `platform_audit_log`,
  „zakończ" wraca do konta administratora.

**Faza C** - edycja miejsca tworzy wpis audytu z `actor_kind='human'`; publikacja pakietu bez
`polar_product_id` odrzucona z czytelnym błędem.

**Faza D** - `sources_run` na jednym źródle z limitem 20 stron → wiersze w `catalog_ingest`,
przebieg widoczny w `/console/sources`, zero rekordów bez `source_url`. Powtórzony przebieg bez
zmian po stronie serwisu → `created = 0`, rosną tylko `last_seen_at`. Punkt obecny w dwóch
serwisach → jeden `catalog_places`, dwa `catalog_place_sources`.

**Faza E**
```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H 'authorization: Bearer <token>' -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
Następnie podłącz serwer w Claude Code i przejdź pełną ścieżkę: wyszukaj → popraw → opublikuj →
sprawdź wpis audytu z `actor_kind='agent'`.

**Faza F** - w trybie incognito: `/share/<token>` renderuje tylko zakresy z `scopes`;
odwołanie linku w konsoli daje 404 przy następnym wejściu; `/packs/<slug>` działa bez sesji,
pokazuje próbkę miejsc i atrybucję, a pełna lista pozostaje ukryta. Test izolacji: żaden
publiczny endpoint nie zwraca pola spoza białej listy.

**Faza G** - zakup pakietu w sandboxie → `pack_entitlements` → pakiet w `add-place-dialog` →
dodanie miejsca tworzy `places.source='catalog'`. Organizacja bez zakupu nie widzi miejsc pakietu
w żadnym endpoincie.

**Wizualnie (SPEC §2)** - Playwright na `/console/*`, `/packs`, `/packs/$slug` i `/share/$token`
w jasnym i ciemnym motywie, 360 px i 1440 px, zero błędów w konsoli. Konsola i strony publiczne
przechodzą ten sam próg krytyka co reszta aplikacji.
