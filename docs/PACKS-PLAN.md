# Pakiety miejsc: role platformowe, katalog, scraping, MCP i treści publiczne

## Kontekst

planned.travel to własna implementacja (clean-room) funkcjonalności TREK, na Cloudflare Workers,
TanStack Start, D1 + Drizzle. Po wydaniu produkcyjnym oprócz subskrypcji chcemy sprzedawać
**pakiety miejsc** - kuratorowane kolekcje pól kempingowych i miejsc postojowych dla kamperów,
z których użytkownik planuje podróż.

Żeby taki pakiet powstał i dał się sprzedać, brakuje w repo czterech rzeczy:

1. **ról platformowych i zarządzania użytkownikami** - dziś jedyna rola to rola w organizacji
   (`member.role`), a `isAdmin` w `src/routes/_app/-server/shell.ts` znaczy „admin tego
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
Wykonana w Fazie A: dostawcą jest Polar, a po Stripie nie ma w `src/` ani jednego importu.

## Decyzje przyjęte

| Obszar               | Decyzja                                                                          |
| -------------------- | -------------------------------------------------------------------------------- |
| Billing              | Polar.sh **zastąpił** Stripe (Faza A) - subskrypcje i pakiety u jednego dostawcy |
| Źródła danych        | Scrapujemy wszystkie trzy serwisy; provenance zapisywana przy każdym rekordzie   |
| MCP                  | Własna implementacja JSON-RPC 2.0 / Streamable HTTP, bez nowych zależności       |
| Role i administracja | Plugin `admin` Better Auth + konsola platformy `/_app/console`                   |
| Treści publiczne     | Uogólnione `share_links` + publiczne strony pakietów, moderowane z konsoli       |

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
- Paczka `stripe` **została usunięta w Fazie A**, jako wyjątek nazwany razem z dwiema paczkami
  React Email - i to zamyka listę wyjątków. `/usr/bin/grep -c stripe pnpm-lock.yaml` zwraca `0`.
  Reguła bez zmian: każda inna paczka to finding, nigdy `pnpm add`.

Podczas implementacji agent **weryfikuje kontrakty w dokumentacji** (Polar: nazwy zdarzeń webhooka
i nagłówki podpisu; Firecrawl: kształt `formats`/`json`/`webhook`; Better Auth: opcje `admin()`),
zamiast opierać się na pamięci. W sesji dostępne są `mcp__firecrawl__*` - użyj ich do rozpoznania
trzech źródeł **przed** napisaniem adapterów.

---

## Faza 0 - kontrakt dokumentów (wykonana)

Ultrabuild czyta `docs/SPEC.md`, `DESIGN.md`, `ARCHITECTURE.md`, `DEPLOY.md` jako definicję
gotowości. Kontrakt musi opisywać nowy stan, zanim ruszy budowanie. Lista poniżej to zakres tej
fazy, zapisany tak, jak go zlecono - wszystkie pozycje są zrobione, łącznie z wymianą `STRIPE_*`
na `POLAR_*` w `.dev.vars.example`.

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

Warunek wstępny Fazy G. **Stripe zniknął z repozytorium w tej fazie** - nie został jako martwy
kod „do sprzątnięcia później", bo późniejsze fazy budowałyby wtedy na mylnym założeniu, że jeszcze
gdzieś żyje. Decyzja użytkownika z 22.08: jesteśmy na etapie build, więc zmieniamy wszystko naraz.

**Status: kod napisany, matryca sandboxowa nieprzejdzona.** Sześć itemów wylądowało przez sześć
rund: runda 5 domknęła trwałość `pendingChange`, a runda 6 determinizm fikstury demo i tę jedną
linijkę copy, której nie miał żaden item. `/usr/bin/grep -ril stripe src/` zwraca pustkę, a
`docs/DEPLOY.md` §9.11 nadal ma osiem niezweryfikowanych wierszy, bo **żadnej rundzie nie wydano
poświadczeń do Polara** - `POLAR_ACCESS_TOKEN` i `POLAR_WEBHOOK_SECRET` były puste z założenia,
więc nie padło ani jedno żywe wywołanie i nie przyszła ani jedna żywa dostawa. Zielony
`pnpm test` mówi, co robi nasz handler, nie co robi Polar.

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

| Twierdzenie z pierwszej wersji planu                | Jak jest naprawdę                                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/checkout-sessions`                        | nie istnieje; są `POST /v1/checkouts/` i `POST /v1/customer-sessions/`                                                    |
| `incomplete*` nie istnieje w Polarze, zawęź krotkę  | **istnieje**; osiem wartości Polara = osiem w krotce `SUBSCRIPTION_STATUSES` (`src/lib/plans.ts`), **nie ruszamy krotki** |
| `subscription.cycled\|paused\|resumed` nie istnieją | **istnieją**; enum ma 41 wartości. Okrojoną listę 35 niesie schemat narzędzia MCP, nie API                                |
| rename kolumn to osobna decyzja                     | rename **robimy**, razem z usunięciem Stripe'a                                                                            |

### Produkty w sandboxie - już utworzone

Organizacja DESIGN4PRO (`0cad0d45-3b92-4144-ad4c-1438ec9cd6d3`), cztery produkty gotowe,
identyfikatory w `.env.local` (plik ignorowany przez git):

| plan | interwał | kształt ceny                        | kwota           |
| ---- | -------- | ----------------------------------- | --------------- |
| Solo | monthly  | fixed                               | 900             |
| Solo | yearly   | fixed                               | 9000            |
| Crew | monthly  | **seat_based**, volume, 2-10 miejsc | 700 za miejsce  |
| Crew | yearly   | **seat_based**, volume, 2-10 miejsc | 7000 za miejsce |

Wszystkie z `trial_interval: day` × 14, zgodnie z `trialDays: 14` w `plans.ts`. Każdy produkt niesie
cenę w EUR **i** USD, bo Polar wymaga obecności domyślnej waluty prezentacyjnej organizacji (EUR),
a nasz katalog jest w USD. Kwoty są równe nominalnie (9 EUR = 9 USD), nie przeliczone kursem -
**do potwierdzenia przed produkcją**.

### Crew jest seat-based i przetrwał migrację

Faza 0 przegapiła to w całości: słowo „seat" nie padło ani razu w SPEC, DEPLOY, CATALOG ani w tym
planie, podczas gdy `src/lib/plans.ts` deklaruje dla Crew `seatBased: true`,
`seatRange {min: 2, max: 10}` i `perSeat: true`.

**Jak to wygląda po migracji.** `resolvePlanSelection()` w `src/server/billing/checkout.ts` przepuszcza
żądaną liczbę miejsc przez `clampSeats(plan, …)`, więc do Polara nie trafia wartość spoza zakresu
planu - klient nie może wynegocjować jedenastego miejsca podmianą pola. Ciało `POST /v1/checkouts/`
dostaje trzy klucze **tylko dla planu seat-based**:

```
seats:     selection.seats
min_seats: seatRange.min
max_seats: seatRange.max ?? seatRange.min
```

Plan płaski (Solo) nie niesie żadnego z nich - Polar dokumentuje je jako działające wyłącznie
z cennikiem seat-based, a checkout Crew, który by je pominął, policzyłby dziesięć osób jak jedną.
Zweryfikowane na żywym OpenAPI (`info.version` 2026-04): `CheckoutProductsCreate` ma trzydzieści
właściwości, z których wymagana jest jedna (`products`), a te trzy - `seats`, `min_seats`,
`max_seats` - są jedynymi dotyczącymi miejsc. Cztery produkty w sandboxie utworzono jako
`seat_based` (volume, 2-10 miejsc) właśnie po to, żeby ta ścieżka miała po drugiej stronie
cennik, który ją rozumie.

Zmiana liczby miejsc na istniejącej subskrypcji to osobny wariant unii `SubscriptionUpdate`
Polara: ciało niosące jednocześnie produkt i miejsca dopasowuje się do wariantu „seats" i gubi
produkt. Dlatego zmiana planu, która **równocześnie** zmienia rozmiar zespołu, to dwa wywołania
`PATCH /v1/subscriptions/{id}` - najpierw produkt - i dopiero druga odpowiedź opisuje oba ruchy.

### Co powstało, item po itemie

Sześć itemów, własność rysowana tak, żeby pliki, które muszą się zgadzać, miały jednego
właściciela, a testy należały do właściciela kodu, który testują. Poniżej to, co faktycznie
wylądowało - plan zamieniony na opis stanu.

| #   | Item                  | Co jest na dysku                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | katalog produktów     | `src/lib/plans.ts` rozwiązuje cztery identyfikatory z `VITE_POLAR_PRODUCT_SOLO_MONTHLY`, `…_SOLO_YEARLY`, `…_CREW_MONTHLY`, `…_CREW_YEARLY`; `PlanPrice.priceId` → `productId`, `PRICE_IDS` → `PRODUCT_IDS`, `planForPriceId` → `planForProductId`. Oba workflow'y CI i `.dev.vars.example` niosą ten sam zestaw i żaden inny. Pierwsze testy, jakie ten plik kiedykolwiek miał.                                                                                           |
| 2   | klient REST           | `src/server/billing/polar.ts` - cienki `fetch` (base URL wg `POLAR_SERVER`, `Authorization: Bearer`, retry, timeout) plus weryfikacja podpisu Standard Webhooks na WebCrypto. Brak sekretu → `BillingConfigError` z dokładną komendą `wrangler secret put`. Zero `@polar-sh/sdk`.                                                                                                                                                                                          |
| 3   | rdzeń zakupowy        | `checkout.ts` (`POST /v1/checkouts/`, `POST /v1/customer-sessions/`, `PATCH /v1/subscriptions/{id}`), `types.ts`, `mapping.ts` - statusy Polara na `SUBSCRIPTION_STATUSES` jeden do jednego, krotka ośmiu wartości nietknięta.                                                                                                                                                                                                                                             |
| 4   | webhook               | `src/routes/api/polar/webhook.ts` (trasa przeniesiona, `routeTree.gen.ts` **regenerowany**), `src/server/billing/webhook.ts` - podpis → claim `webhook-id` w KV → jeden mały zapis do D1 → unieważnienie klucza planu → reszta na `TASKS`.                                                                                                                                                                                                                                 |
| 5   | React Email           | **dziewięć** szablonów w `src/server/email/templates/`, nie cztery: pięć istniejących maili konta przepisanych na komponenty (`verify-email`, `reset-password`, `email-changed`, `delete-account`, `organization-invitation`) plus cztery billingowe (`subscription-confirmed`, `plan-changed`, `payment-failed`, `pack-purchased`). Każdy ma wersję tekstową, wyprowadzaną z HTML-a przez `toPlainText()`, więc URL nie może istnieć w jednej wersji i zniknąć z drugiej. |
| 6   | powierzchnie widoczne | `billing.tsx`, `pricing.tsx`, `terms.tsx` - poprawka Merchant-of-Record i alert `?plan=changed`, który rozróżnia zmianę natychmiastową od zaplanowanej na koniec okresu.                                                                                                                                                                                                                                                                                                   |

**Cztery rzeczy, których pierwotny plan nie przewidział, a które kosztowały rundy.** Wszystkie
cztery są teraz zapisane jako reguła w `docs/SPEC.md` §8 („jedno pojęcie, jeden właściciel"),
gdzie stoją jako cztery wiersze tablicy dowodowej:

1. Item 1 przemianował `PlanPrice.priceId`, a jego pięciu konsumentów siedziało w itemach
   odłożonych na później. Osiem błędów typów, 338 czerwonych testów, `MISSING_EXPORT` przy
   buildzie.
2. `pnpm remove stripe` wyjęło paczkę z manifestu, kiedy 31 plików w `src/` jeszcze ją
   importowało. Zejście 31 → 12 → 0 zajęło dwie kolejne rundy.
3. Napis „14-day free trial, no card needed" powstawał w `planPriceFootnote()`
   (`src/components/marketing/plans.tsx`), którego nie miał żaden item - więc poprawka
   Merchant-of-Record ominęła go i przez dwie rundy stał obok FAQ mówiącego, że Polar pobiera
   kartę. Zamknęła go dopiero runda 6, itemem narysowanym wokół **twierdzenia**, a nie wokół
   stron, na których je widać.
4. Ten sam napis, **zgłoszony jako naprawiony** w rundzie 4 na dowodzie
   `curl … /pricing | grep -c 'no card needed'` zwracającym `0`. Napis był wtedy serwowany dwa
   razy na każdej ze stron. Dokument SSR nie ma ani jednego znaku nowej linii, a `grep -c` liczy
   **linie**, nie wystąpienia, więc ta komenda nie mogła zwrócić dwójki niezależnie od stanu
   strony; `curl -s` na martwym porcie daje dodatkowo czyste `0` bez żadnego komunikatu. Reguła,
   która z tego została: na stronie strumieniowanej grep po odpowiedzi HTTP nie jest dowodem -
   trzeba ją wyrenderować i policzyć w `document.body.innerText` **oraz** `textContent`.

### `pendingChange` - zmiana planu, która jeszcze nie weszła

Pojęcie pochodzi wprost od Polara. Przy `proration_behavior: "next_period"` (jedna z czterech
wartości `SubscriptionProrationBehavior` - obok `invoice`, `prorate` i `reset`) subskrypcja **nie**
zmienia się od razu: odpowiedź i każdy późniejszy odczyt niosą `pending_update`, obiekt
`PendingSubscriptionUpdate`. Na żywym OpenAPI (`info.version` 2026-04) ma on sześć pól -
`created_at`, `modified_at`, `id`, `applies_at`, `product_id`, `seats` - i wszystkie sześć są
wymagane. To jest wiersz 3 macierzy §9.11 i jedyny scenariusz, w którym uprawnienia mają przeżyć
do końca opłaconego okresu.

Ścieżka po naszej stronie, w kolejności:

- **Pole jest nazwane w schemacie i parsowane raz.** `polarSubscriptionSchema` w
  `src/server/billing/mapping.ts` deklaruje `pending_update: polarPendingUpdateSchema.nullish()`,
  a `patchSubscription()` w `src/server/billing/checkout.ts` robi jedno
  `polarSubscriptionSchema.parse(raw)` i zwraca `PolarSubscription`. Surowa odpowiedź nie jest
  parsowana drugi raz - ani tam, ani nigdzie indziej. Wcześniejszy projekt zakładał odwrotnie
  (osobny parse przy jednym wywołaniu) i został **porzucony**: `z.object()` w Zod 4 obcina klucze,
  których nie nazywa, więc schemat pomijający `pending_update` zmuszałby _każdego_ czytelnika do
  drugiego parse'a - a webhook, który jest reconcilerem, nigdy go nie robił i dlatego gubił
  zaplanowaną zmianę.
- `polarPendingUpdateSchema` nazywa dwa z sześciu pól - `applies_at` i `product_id` - bo tyle
  potrzeba, żeby zbudować `PendingPlanChange`. `seats` z `pending_update` nie jest dziś czytane,
  więc zaplanowana **zmiana rozmiaru zespołu** bez zmiany produktu nie ma jak trafić na ekran;
  to otwarty follow-up na `src/server/billing/**`, nie na tym dokumencie.
- `pendingChangeFor()` w `checkout.ts` czyta `applied.pending_update` z już sparsowanej
  subskrypcji i przepuszcza je przez `pendingChangeFromPolar()` (`mapping.ts`), które sprowadza
  je do `PendingPlanChange { planId, interval, effectiveAt }` albo do `null`, gdy czegokolwiek z
  tej trójki nie da się opisać w całości. Gdy Polar nie odesłał `pending_update`, a proracja była
  `next_period`, fallbackiem jest koniec bieżącego okresu.
- `persistChangedSubscription()` zapisuje to razem z resztą wiersza, jednym upsertem.
- Trwałość to trzy kolumny na `subscriptions`: `pending_plan`, `pending_interval`,
  `pending_effective_at`. `pending_plan` niesie identyfikator **katalogowy** (`free|solo|crew`),
  a nie zgrubny tier z kolumny `plan` (`free|starter|pro|business`) - to dwa różne słowniki i
  pomylenie ich jest tu najłatwiejszym błędem.
- `recordFromRow()` w `store.ts` ożywia trójkę, a niekompletną trójkę traktuje jako brak zmiany -
  wiersz z ustawionym planem i pustą datą nie może wyprodukować `Invalid Date`, który potem
  poleciałby do KV i do maila.
- Kształt w cache'u ma własną wersję: klucz `billing:plan:<wersja>:<orgId>` niesie
  `PLAN_STATE_CACHE_VERSION` z `entitlements.ts`, podbijaną przy każdej zmianie kształtu, więc
  ciepły wpis w starym kształcie jest ignorowany, a nie źle odczytany.

Dlaczego to w ogóle wymagało osobnej rundy: pole `pendingChange` istniało w typie i w cache'u,
zanim istniała kolumna. Testy przechodziły, bo `FakeSubscriptionStore` trzymał cały rekord
domenowy w mapie i oddawał go z powrotem - był **szerszy** niż prawdziwy magazyn, więc żaden
mapper nie był ćwiczony i żadne gubione pole nie mogło się ujawnić. Reguła, która z tego zostaje:
test double nie może być szerszy niż rzecz, którą zastępuje, a runda, która dokłada pole do
rekordu, dokłada też przejście przez prawdziwą bazę (wzorzec z
`src/server/billing/__tests__/limits.test.ts`, który jedzie po realnym SQLite).

### Reguła portów - już nie prośba, tylko kod

Cztery rundy z rzędu puściły Playwrighta na porcie spoza zakresu: dwa razy 3000, raz na serwer
odpowiadający 500 na wszystko, raz na 3002 należący do innego worktree - i ta ostatnia runda
sfotografowała aplikację z cudzej gałęzi, po czym zaliczyła dziewięć porażek jako dowód. Od Fazy A
`playwright.config.ts` **rzuca wyjątkiem**, jeśli port rozwiązany z `PLAYWRIGHT_BASE_URL` nie mieści
się w zarezerwowanym zakresie; furtką jest `PLAYWRIGHT_ALLOW_ANY_PORT=1`, a `CI` jest zwolnione.
Komunikat błędu podaje jedyne poprawne wywołanie ręczne: `pnpm exec vite dev --port <port>
--strictPort` - nigdy `pnpm dev`, który ma na sztywno `--port 3000`. (Zakres z tej rundy, 3010-3020,
przeniósł się później na **3030-3040**, bo money-tracker na tym samym hoście ma 3010 na sztywno
i nie ma alokatora. Aktualny zakres jest zawsze w `playwright.config.ts`.)

Dwie konsekwencje warte zapisania. Po pierwsze: `pnpm dev` zostaje z portem 3000, bo to port
dewelopera, więc reguła o zakresie zarezerwowanym może żyć tylko w tym pliku konfiguracyjnym oraz
w dokumentach.
Po drugie: `scripts/seed/seed.mjs` **nie może** mieć takiego strażnika - to klient HTTP, więc
każdy origin odpowiadający na `/api/dev/seed` wygląda dla niego tak samo. Skrypt sonduje listę
portów i bierze pierwszy, który odpowie, a zarezerwowany zakres jest współdzielony między
worktree'ami; dlatego re-seed pod rundę wymaga jawnego `--url http://localhost:<port>`, inaczej można po
cichu przebudować cudzy workspace. Trzy rundy coraz bardziej stanowczej prozy nie zrobiły tego, co
jedno mechaniczne ograniczenie zrobiło za pierwszym razem.

### Gate mechaniczny

`pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm generate-routes && git diff --exit-code -- src/routeTree.gen.ts`, `pnpm build`, oraz
Playwright **wyłącznie** z jawnym `PLAYWRIGHT_BASE_URL` na porcie z zarezerwowanego przedziału
(dziś 3030-3040), który runda sama zbindowała i ubija po sobie.

### Akceptacja Fazy A - matryca w sandboxie Polara

**Żadnego z ośmiu wierszy nie przeszliśmy.** Rundy budujące dostały puste
`POLAR_ACCESS_TOKEN` i `POLAR_WEBHOOK_SECRET` - taka była decyzja - więc nie było ani jednego
żywego wywołania i ani jednej żywej dostawy. Tabela poniżej jest planem, nie protokołem; pełna
wersja z komendami, kartą testową i warunkami zaliczenia stoi w `docs/DEPLOY.md` §9.11, wraz z
tym, jak odblokować przejście. Wiersz 6 jest pokryty testem na sztucznym runtime, co jest dowodem
o naszym handlerze, nie o Polarze.

Każdy wiersz do przejścia ręcznie w sandboxie i pokryty testem tam, gdzie da się to zrobić bez sieci:

| #   | Scenariusz                              | Oczekiwany wynik                                                                          |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Subskrypcja Solo, miesięcznie i rocznie | checkout → webhook → wiersz w `subscriptions` → moduły odblokowane                        |
| 2   | Podwyższenie Solo → Crew                | proracja po stronie Polara, uprawnienia zmieniają się natychmiast                         |
| 3   | Obniżenie Crew → Solo                   | zmiana na koniec okresu, uprawnienia trzymają do `current_period_end`                     |
| 4   | Anulowanie                              | `cancel_at_period_end`, dostęp do końca okresu, potem Free                                |
| 5   | Wznowienie przed końcem okresu          | subskrypcja wraca, bez nowego checkoutu                                                   |
| 6   | Nieudana płatność                       | `past_due` utrzymuje dostęp (dunning), `unpaid` odcina                                    |
| 7   | Faktury                                 | read-only lista zamówień w `/settings/billing` (Orders API) + pobranie PDF                |
| 8   | Portal klienta                          | „Zarządzaj płatnościami" → `customer-sessions` → edycja danych faktury i metody płatności |

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

Transport był podłączony przed Fazą A i nie ruszał się:
[src/server/queue/handlers/email.ts](src/server/queue/handlers/email.ts) POST-uje pod
`context.env.EMAIL_API_URL`, a gdy zmiennej nie ma - pod domyślne `https://api.resend.com/emails`,
autoryzując się sekretem `EMAIL_API_KEY`. Brak sekretu to `TaskConfigurationError` z dokładną
komendą, nie cicha porażka.

Faza A zainstalowała React Email (wyjątek wyżej) i przepisała bodies na komponenty. Na dysku jest
**dziewięć** szablonów w `src/server/email/templates/`: pięć kont
(`verify-email`, `reset-password`, `email-changed`, `delete-account`,
`organization-invitation`) i cztery billingowe (`subscription-confirmed`, `plan-changed`,
`payment-failed`, `pack-purchased`). Każdy ma wersję tekstową wyprowadzoną z HTML-a przez
`toPlainText()`, więc URL nie może istnieć w jednej wersji i zniknąć z drugiej.

Dwa długi tej ścieżki są zapisane w `docs/SPEC.md` §3 jako **F1** i **F2** i nie należą do tego
dokumentu: render leci inline na ścieżce żądania zamiast w handlerze kolejki, a sześć z dziewięciu
szablonów nie ma miejsca wysyłki - `queueAuthEmail()` ma trzy wywołania, wszystkie w
`src/server/auth/index.ts`.

---

> **Jak czytać ścieżki w tym dokumencie.** Faza A jest opisem stanu: każdy plik, który nazywa,
> jest na dysku. Jedyny wyjątek powyżej to lista katalogów w §Faza 0 (`src/server/catalog/**`,
> `src/server/mcp/**`, `src/server/public/**`), która cytuje kontrakt `docs/SPEC.md` §6, czyli
> miejsca docelowe. Fazy B-G to plan: nazwane w nich moduły - `src/server/auth/access.ts`,
> `src/server/auth/guard.ts`, `src/server/catalog/**`, `src/server/repos/packs.ts`,
> `src/server/mcp/**`, `src/routes/api/mcp.ts`, `src/server/public/**`,
> `src/routes/api/firecrawl/webhook.ts`, `src/routes/packs.index.tsx`, `src/routes/_app/packs.tsx`,
> `src/components/modules/add-place-dialog.tsx` - **nie istnieją jeszcze** i są kontraktem na to,
> gdzie mają powstać, a nie odniesieniem do kodu. `docs/SPEC.md` §5 i `docs/ARCHITECTURE.md` §2.5
> mówią to samo o tych z nich, które te dokumenty nazywają.
>
> **I dlaczego nie ma tu numerów linii.** Ten dokument cytuje **symbole**, nie linie:
> `PLACE_SOURCES`, `ShareScopes`, `shareLinks`, `SUBSCRIPTION_STATUSES`, `isAdmin`. Numer linii
> w planie, który przeżywa kilkanaście rund, jest twierdzeniem o cudzym pliku i psuje się przy
> pierwszym commicie, który nikogo o nic nie pyta - cztery takie cytaty (`schema.ts:159`,
> `schema.ts:253`, `schema.ts:1028`, `plans.ts:32-41`) rozjechały się dokładnie tak i pokazywały
> w rundzie 6 nie to, co obiecywały, mimo że samo twierdzenie obok każdego z nich było prawdziwe.
> Symbol znajduje `/usr/bin/grep -n`, a rename symbolu jest zmianą, którą i tak widać w code
> review. Wyjątkiem są sekcje dokumentów (`§9.11`) i nazwy plików - te są stabilne.

## Faza B - role platformowe i zarządzanie użytkownikami (Better Auth `admin`)

To fundament dla wszystkiego dalej: kurator katalogu, moderator treści publicznych i token MCP
sięgają po ten sam model uprawnień.

**Status: cztery itemy z siedmiu przyjęte, trzy otwarte, zatrzymane świadomie po dwunastu
rundach.** Warstwa serwerowa stoi i jest udowodniona; powierzchnia konsoli istnieje, renderuje się
i nie przeszła własnej poprzeczki. Poniżej rozdzielone jest to, co **zmierzone**, od tego, co
**zadeklarowane** - bo faza spędziła połowę rund na wykrywaniu, że to nie to samo.

### Co jest zrobione i udowodnione

| Item                   | Co dowozi                                                                                                                                      | Czym udowodnione                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| B1 schemat + sesja     | pięć kolumn pluginu, `platform_audit_log` (12 kolumn, 4 CHECK-i międzykolumnowe, 5 indeksów), `staff_api_tokens`, poszerzona biała lista sesji | migracja `0004` w pełni addytywna, zero `__new_*`, zero `DROP TABLE`; CHECK-i sprawdzone wstawkami do wyemitowanego SQL w `node:sqlite` |
| B2 słownik + guard     | zamknięty słownik sześciu zasobów, trzy role, `requirePermission` jako jedyny autoryzator                                                      | macierz 72 komórek w testach; test grafu importów pilnujący, że moduł jest liściowy                                                     |
| B3 rejestracja pluginu | `admin()` w `betterAuth()`, `impersonationSessionDuration: 900`, top-level `disabledPaths`                                                     | test dryfu: 15 ścieżek pluginu równa się `DISABLED_ADMIN_PATHS`; test integracyjny dowozi 404 z każdej z nich przy żywej sesji admina   |
| B4 writer audytu       | `src/server/catalog/audit.ts` jako jedyny pisarz, prune 400-dniowy, wspólny regex akcji w module liściowym                                     | spacer po grafie modułów zastąpił grepa, który dwukrotnie przepuścił naruszenie; sondy wstawek na wszystkich CHECK-ach                  |

### Co jest otwarte

- **B5 funkcje serwerowe konsoli** - piętnaście funkcji istnieje i działa. Otwarte: nieprzypisany
  moduł na 247 linii w tym katalogu bez testu, oraz `applyBan`, którego kompensacja nadal
  przywraca jednosekundowy ban nad już wygasłym.
- **B6 pasek impersonacji** - renderuje się, ma odliczanie, jest niezamykalny. Otwarte: przy 360px
  nazwisko operatora jest ucinane, więc pasek przestaje nazywać, kto działa; `--z-impersonation`
  nie wiąże sonnera, który maluje powyżej pasma, więc toast nadal może przykryć przycisk kończący
  cudzą sesję.
- **B7 ekrany konsoli** - `/console`, `/console/users` i `/console/users/$userId` renderują się,
  wejście jest w menu konta. Otwarte: surowe SQL w module trasy (drugi wyjątek od SPEC §6),
  `/console` kosztuje pięć odczytów KV zamiast jednego, oś czasu audytu drukuje surowe id konta
  i rolę obok etykiet obiecujących angielski, a zły parametr wyszukiwania daje 500 z wypisaną
  tablicą Zoda.

### Sześć czerwonych baseline'ów - dlaczego zostają czerwone

> _Zapis historyczny. ADR 0016 zlikwidował baseline'y w całości: `e2e/__screenshots__/` już nie
> istnieje, `--update-snapshots` nie ma czego zapisać, a oceną wizualną jest ślepa para
> `scripts/visual/capture.mjs`. Sześć różnic opisanych niżej nigdy nie zostało wyjaśnionych co do
> przyczyny i nie zostanie - nie ma już czym ich zmierzyć._

`atlas dark`, `settings dark` i cztery migawki `console-user`. Te ostatnie zmieniły wymiary
(1440×2204 → 1440×2078), bo ekran konta dostał trzy panele, których wymaga `docs/ACCESS.md`.
Odświeżenie ich jest jednolinijkowe i **celowo niezrobione**: bramka, która przepisuje własny
wzorzec, nie umie oblać, a różnica na `atlas dark` i `settings dark` nie została jeszcze
wyjaśniona co do przyczyny. Kolejna runda zaczyna od wyjaśnienia tych dwóch, nie od
`--update-snapshots`.

### Jedna własność, której nikt nie zmierzył ponownie

Audytor rundy 6 **obalił pomiarem** natychmiastowość bana: wpisał `banned=1` do D1, wywołał
`GET /api/auth/get-session` z ciepłym ciasteczkiem i dostał 200 z `"banned":false`. Powód:
`disableCookieCache` zdejmuje cache ciasteczka, ale Better Auth nadal rozwiązuje token z KV przed
D1. B5 zbudował potem czyszczenie kluczy KV i `session-keys.test.ts` pokrywa je porządnie, łącznie
z przypadkiem, w którym lista przekracza sufit - to była realna dziura, przez którą ban zostawiał
sesje nieodzyskiwalnie żywe.

Ale to są **testy jednostkowe helperów czyszczenia**, nie powtórzenie tamtego pomiaru.
Nikt - w tym ja - nie sprawdził ponownie, czy zbanowane konto faktycznie traci dostęp przy
następnym żądaniu. Dopóki ktoś tego nie zmierzy tą samą metodą, którą to obalono, ta własność jest
**zadeklarowana, nie udowodniona**, a jest to własność, dla której świadomie zapłaciliśmy odczytem
KV na każde uwierzytelnione żądanie.

### Cztery błędy orkiestratora, zapisane, żeby się nie powtórzyły

1. Wzorzec grepa izolacji miał domykający apostrof, więc łapał tylko import barrelowy i wypisywał
   zero przy czterech głębokich importach. Zielone kryterium, które nie umie się zaczerwienić,
   raportuje się jako dowód.
2. `REPAIR 20` kazał czytać sesje przez endpoint pluginu; ten czyta indeks KV i zwraca pustą
   tablicę, gdy klucza brak - czyli raportuje brak sesji dokładnie wtedy, gdy ban musi je zobaczyć.
   Builder odmówił i miał rację.
3. `REPAIR 39/41` kazał rezerwować dół pod pasek nawigacji, który nigdy nie zasłaniał treści.
   Krytyk zastrzegł to w tym samym zdaniu - „even allowing for the capture method" - a orkiestrator
   zostawił obserwację i wyrzucił zastrzeżenie. Pełnowysokościowy zrzut komponuje element
   `position:fixed` w środek strony i nie jest dowodem o nim w przewijanym oknie.
4. `REPAIR 51/63` wymagały przeniesienia kodu **przez granicę itemów**, podczas gdy oba szły
   równolegle z tymi ścieżkami u różnych właścicieli. Naprawa relokująca kod między itemami wymaga,
   żeby `ownedPaths` jechały razem z kodem albo żeby itemy scaliły się na tę rundę.

> **Specyfikacją tej fazy jest `docs/ACCESS.md`, a nie ta sekcja.** Sekcja poniżej to indeks:
> mówi, co faza obejmuje i jakie decyzje zapadły, a szczegóły wiążące - słownik uprawnień co do
> komórki, dwanaście kolumn audytu, zamknięty słownik 31 akcji, cztery obowiązkowe testy drift,
> retencja - są w `ACCESS.md` i nie są tu powtarzane. Runda, która przeczyta tylko te kilkadziesiąt
> linii, dowiezie fazę oblewającą kontrakt, wobec którego jest mierzona.

### Zweryfikowane fakty, którymi ta faza się kieruje

Pierwsza wersja tej sekcji miała pięć błędów blokujących. Sprawdzone w `node_modules`
(`better-auth@1.7.1`, ta sama kopia, którą zbuduje runda), **nie z pamięci**:

| Twierdzenie z pierwszej wersji planu                                        | Jak jest naprawdę                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kolumny to `user.ban_reason`, `user.ban_expires`, `session.impersonated_by` | To nazwy SQL. Adapter Drizzle nigdy ich nie widzi: rozwiązuje pole jako `schemaModel[getFieldName(...)]`, a `getFieldName` nie robi żadnej transformacji wielkości liter, więc indeksuje **klucz właściwości JS**. Plugin deklaruje `role`, `banned`, `banReason`, `banExpires`, `impersonatedBy` (`plugins/admin/schema.mjs`). Literalne wdrożenie planu wywala `BetterAuthError` przy pierwszym banie. Argumenty tekstowe (nazwy SQL) zostają snake_case wg konwencji repo                                                                                                  |
| `admin({ ac, roles, ... })` - `ac` niesie autoryzację                       | `ac` jest **martwe po stronie serwera**: jedyny odczyt `options?.ac` w całym pluginie to `plugins/admin/client.mjs:20`. Autoryzacja czyta `input.options?.roles \|\| defaultRoles` (`has-permission.mjs:7`). Nośną opcją jest `roles` i musi zawierać komplet `admin`/`curator`/`user`; bez tego `curator` jest `undefined` i dostaje odmowę na wszystkim                                                                                                                                                                                                                     |
| Cztery opcje wystarczą                                                      | Brakują dwie. `impersonationSessionDuration` pominięte cichcem daje 3600 s zamiast wymaganych przez `ACCESS.md` §6.2 **900 s**. `disabledPaths` **nie jest argumentem `admin()`** tylko opcją top-level `betterAuth` (rodzeństwo `plugins`), egzekwowaną w `onRequest` routera przez `return new Response("Not Found", { status: 404 })`                                                                                                                                                                                                                                      |
| Akcje konsoli wołają `/api/auth/admin/*` klientem Better Auth               | Klient jest bezwarunkowo HTTP, a `ACCESS.md` §2.6 wymaga, by wszystkie 15 ścieżek zwracało 404, i zakazuje rejestrowania `adminClient()`. Mechanizmem jest `auth.api.<endpoint>({ body, headers })` **w procesie**: `api` buduje `getEndpoints()` i nie przechodzi przez router, więc `disabledPaths` go nie dotyka. Dla impersonacji to nie jest detal stylu - jej **całym efektem** są nagłówki `Set-Cookie`, które wrapper HTTP zjada, więc wołanie zgłosiłoby sukces i nie zmieniło nic. Stąd `returnHeaders: true` i wmieszanie nagłówków w odpowiedź funkcji serwerowej |
| `platform_audit_log` ma dziewięć kolumn                                     | Ma **dwanaście** i `ACCESS.md` §4.1 mówi wprost „this is the whole list". Brakowały `actor_role` (rola w chwili akcji, wartość a nie join, bo `user.role` jest zmienne) i `token_id` (FK → `staff_api_tokens`). Do tego dwa CHECK-i międzykolumnowe i pięć indeksów. W SQLite dodanie FK albo CHECK później to recreate tabeli, a `docs/DEPLOY.md` §register liczy recreate jako niedodatkowy                                                                                                                                                                                 |

Szósta poprawka jest kontraktowa, nie faktograficzna: `docs/SPEC.md` §5 zamykał listę tabel
globalnych na ośmiu nazwach, jednocześnie nakazując zapis do `platform_audit_log`. `ACCESS.md`
§4.1 notował to jako FU-2 i nie rozstrzygał. **Faza B amenduje `SPEC.md` §5 do dziewięciu nazw** i
wydziela pisarza tabeli audytu, bo `repo.ts` do niej dopisuje, więc nie może być też przez nią
osiągany. FU-2 zamknięte.

### Decyzje użytkownika z 23.08

| Pytanie                                      | Decyzja                                                                                                      | Konsekwencja                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ban a 300-sekundowy cache sesji w ciasteczku | **Zabić cache.** `disableCookieCache` w `src/server/auth/session.ts` i usunięcie bloku `session.cookieCache` | Kryterium „natychmiastowe wylogowanie" zostaje prawdziwe. Koszt: jeden odczyt KV na każde uwierzytelnione żądanie w całej aplikacji, na stałe. Świadomie kasujemy optymalizację, bo ban jest kontrolą bezpieczeństwa i okno opóźnienia było na niej nie do obronienia. Osobno: funkcja banująca **enumeruje tokeny sesji celu z D1**, a nie ufa indeksowi KV `active-sessions-<userId>`, który jest eventually consistent |
| Czy Faza B tworzy `staff_api_tokens`         | **Tak, samą tabelę.** UI wydawania tokenów zostaje w Fazie E                                                 | `platform_audit_log` dostaje prawdziwy FK `token_id` i CHECK dla `actor_kind='agent'` od razu, w jednym `CREATE TABLE`. Płacimy recreate zero razy zamiast raz                                                                                                                                                                                                                                                            |
| Moderacja `share_links`                      | **Tylko wpis w słowniku.** `repos/shares.ts`, `fns/console/shares.ts` i ekran czekają na Fazę F              | Słownik jest zamknięty i nie urośnie później bez zmiany `ACCESS.md`, więc zasób `share` musi wejść teraz. Powierzchnia czeka na migrację, która da `share_links` dyskryminator (FU-4)                                                                                                                                                                                                                                     |
| Zakres paska impersonacji                    | **Tylko `/_app`**                                                                                            | `AppShell` to jedyny wrapper z sesją w zasięgu. Wciągnięcie sesji do `__root.tsx` postawiłoby odczyt auth przed każdą publiczną stroną marketingową. Zapisane w `ACCESS.md` §6.1 jako świadome ograniczenie                                                                                                                                                                                                               |
| „Ban i impersonacja audytowane bez wyjątku"  | **Dwa nazwane wyjątki**                                                                                      | Auto-unban wygasłego bana dzieje się w `session.create.before` pluginu, bez wywołania konsoli; audytowany z tripwire `databaseHooks.user.update.after` jako `actor_kind='system'`. Impersonacja **przez wygaśnięcie** nie produkuje żadnego zdarzenia serwerowego, więc `ACCESS.md` §4.2 zawęża wpis do akcji. Oba zapisane, bo milczenie czyniło „without exception" fałszem                                             |

### Konfiguracja

`src/server/auth/access.ts` (**nowy**, izomorficzny słownik uprawnień):

```ts
const statement = {
  ...defaultStatements, // user: [...], session: [...]
  catalog: ['read', 'write', 'publish'],
  pack: ['read', 'write', 'publish'],
  source: ['read', 'run'],
  share: ['read', 'revoke'],
} as const
```

Role: `admin`, `curator` (catalog/pack/source/share, **bez** `user` i `session`), `user` (nic
platformowego, rola domyślna). **`admin` nie znaczy „wszystko"**: `user:impersonate-admins` jest
odmówione każdej roli włącznie z `admin` (`ACCESS.md` §2.4), a `allowImpersonatingAdmins` zostaje
nieustawione, żeby własna kontrola pluginu nie obeszła naszej. Procedura dla admin-na-adminie to
degradacja → impersonacja → przywrócenie, trzy audytowane zdarzenia. Wiążące są 72 komórki
z `ACCESS.md` §2.1-§2.3, nie to zdanie. Role budowane z `statement`, nigdy dziedziczone z `adminAc`.

Plik importuje wyłącznie `better-auth/plugins/access` i `better-auth/plugins/admin/access` - cały
osiągalny graf tych dwóch podścieżek to ~6 modułów bez ani jednego wbudowanego `node:`. Nic w
toolchainie tego nie pilnuje, więc pilnuje tego test.

`src/server/auth/index.ts` - dołóż `admin({ ac, roles, adminRoles: ['admin'], defaultRole: 'user',
impersonationSessionDuration: 900, bannedUserMessage: <copy repo> })` do listy pluginów obok
`organization`, `twoFactor` i `passkey`, oraz **top-level `disabledPaths`** z kompletem 15 ścieżek
`/admin/*`. `adminUserIds` celowo nieobecne - nie puste, nieobecne (`ACCESS.md` §1.4).

`src/server/db/auth-schema.ts` - pięć pól pluginu **kluczami camelCase**: `user.role` text,
`user.banned` `integer({ mode: 'boolean' })` `.notNull().default(false)`, `user.banReason` text,
`user.banExpires` `integer({ mode: 'timestamp_ms' })`, `session.impersonatedBy` text. Indeks na
`user.role`.

`src/components/layout/session.ts` + `src/routes/_app/-server/shell.ts` - do sesji dochodzi
`platformRole` i pochodne `isPlatformAdmin` / `isCurator`. Istniejące `isAdmin` **zostaje** rolą
w organizacji - nie zmieniaj jego znaczenia, dołóż obok. Uwaga: `normaliseSession` w
`src/server/auth/tenant.ts` przepuszcza zamkniętą białą listę pól i **wyrzuca resztę**, więc
`impersonatedBy` jest dziś strukturalnie nieosiągalne z Reacta. Pięć plików musi się zmienić po
kolei, zanim pasek wyrenderuje cokolwiek innego niż `undefined`.

`src/server/auth/guard.ts` (**nowy**) - `requirePermission(session, { catalog: ['write'] })`, jedna
funkcja używana przez funkcje serwerowe konsoli **i** przez MCP, żeby nie było dwóch niezależnych
implementacji autoryzacji. Jest synchronicznym predykatem nad czystym `role.authorize`, więc
**nie może** wymusić zapisu audytu - patrz niżej.

### Audyt

`platform_audit_log` (**nowa tabela globalna**, `schema.ts`), dwanaście kolumn, dwa CHECK-i
międzykolumnowe i pięć indeksów - komplet w `ACCESS.md` §4.1, tu nie powtarzany. Zastępuje osobną
tabelę rewizji katalogu: oś czasu miejsca to zapytanie po `entity_type = 'catalog_place'`.
Istniejący `audit_log` jest tenantowy i zostaje bez zmian.

Jedynym pisarzem jest `src/server/catalog/audit.ts`. Wpis powstaje **po** zatwierdzeniu mutacji,
w osobnym `try/catch`, który nigdy nie zamienia wykonanej akcji w `500`; dla czterech czasowników
ban/impersonacja ponawiany raz i podnoszony przez `src/server/observability` na najwyższej
istotności. Zdanie „zapis wymuszony w `requirePermission`-owanych mutacjach" z pierwszej wersji
planu było nieprawdziwe w obie strony: `requirePermission` nic po mutacji nie uruchamia, a hak
Better Auth nie uniesie kontraktu, bo `options.hooks.after` zamienia rzucone `APIError` w
odpowiedź, a `databaseHooks.*.after` re-rzuca - obie drogi oddają wołającemu błąd po akcji, która
się powiodła. To dokładnie ten tryb awarii, przed którym `ACCESS.md` §4.3 ostrzega.

### Konsola `/_app/console`

Nowa gałąź tras, oddzielona od istniejącego `/_app/admin` (który pozostaje panelem workspace'u i
**nie jest ruszany**). Wejście widoczne w `src/components/layout/user-menu.tsx` tylko dla ról
platformowych.

- `console/route.tsx` - guard w `beforeLoad` przez funkcję serwerową; konto z rolą `user` jest
  odrzucane, zanim padnie pytanie o jakikolwiek statement. Nawigacja **lokalna dla gałęzi**
  w `console/-ui/console-nav.tsx`, wzorowana na `src/routes/_app/-ui/settings-nav.tsx`, z własną
  literałową unią `to`. **Nie `PillNav`**: jego `PrimaryNavTo` to zamknięta czteroelementowa unia
  we współdzielonym `src/components/layout/nav-model.ts`, a poszerzanie jej poszerzyłoby też to,
  co przyjmują `TopNav` i `MobileNav` - zmiana typów nawigacji produktowej bez powodu produktowego.
- `console/index.tsx` - przegląd: użytkownicy, katalog wg statusu, ostatnie przebiegi scrapingu,
  ostatnie wpisy audytu.
- `console/users.tsx` - tabela użytkowników (szukanie, filtr po roli i statusie bana), akcje:
  zmiana roli, ban/unban z powodem i terminem, wygaszenie sesji, reset hasła, utworzenie konta,
  impersonacja. **Bez wirtualizacji.** `listUsers` jest już stronicowane i sortowane po stronie
  serwera (`limit`/`offset`), więc ograniczona strona wierszy nic z okienkowania nie zyskuje,
  a `Table` w `src/components/ui` nie ma na to szwu: trzyma własny kontener przewijania z
  `overflow-x-auto` i forwarduje ref do `<table>`, nie do kontenera. Używamy istniejących
  `Table` + `Pagination` + `paginationRange`.
- `console/users.$userId.tsx` - karta użytkownika: organizacje i role w nich, sesje, historia
  audytu, subskrypcja.
- Impersonacja: trwały pasek ostrzegawczy nad outletem tras `/_app`, gdy sesja jest
  impersonowana, z odliczaniem i akcją „zakończ" jako pierwszym stopem tabulacji. Bez tego funkcja
  jest niebezpieczna. Pasek przesuwa początek viewportu, więc jest jednym itemem razem z
  kontraktem `--nav-h` i wszystkim, co się do niego przypina (FU-1: dwa nowe tokeny lądują
  w `src/styles/tokens.css` i w `DESIGN.md` w tym samym commicie).

Wszystkie akcje idą przez `src/server/fns/console/*`, które wołają `auth.api.<endpoint>` **w
procesie**, nigdy klientem Better Auth i nigdy bezpośrednim `fetch` z komponentu. Dla
`impersonateUser` i `stopImpersonating` z `returnHeaders: true` i wmieszaniem zwróconych nagłówków
w odpowiedź funkcji serwerowej.

### Czego ta faza świadomie nie robi

- Nie buduje UI wydawania tokenów MCP (`console/tokens`) - sama tabela `staff_api_tokens` tak, UI
  w Fazie E.
- Nie buduje ekranu moderacji linków ani `repos/shares.ts` - Faza F, po migracji z FU-4.
- Nie buduje ekranów kuratora katalogu (`console/places`, `console/ingest`, `console/packs`,
  `console/sources`) - Faza C, w tej samej gałęzi tras.
- Test „unia stałych akcji równa się dokładnie liście z §4.2" nie może w tej fazie przejść w
  literalnym brzmieniu: `src/server/catalog/` nie istnieje, a 16 z 31 nazw to akcje katalogowe
  pisane przez Fazę C. W Fazie B test asercjonuje podzbiór `platform.*` (15 nazw) i jest
  rozszerzany w Fazie C; obie sprawdzalne maszynowo połowy - zgodność z regexem i prefiks
  z tablicy §4.2 - wchodzą już teraz.

---

## Faza C - katalog miejsc i panel kuratora

### Model danych (`src/server/db/schema.ts`, nowa sekcja "Catalogue")

Tabele **globalne** (bez `organization_id` - to treść platformy, nie tenanta):

| Tabela                  | Rola                                                                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog_sources`       | źródło (`slug`, `name`, `homepage`, `adapter`, `enabled`, `licence_note`, `last_run_at`)                                                                                                     |
| `catalog_runs`          | przebieg scrapingu (`source_id`, `status`, liczniki `discovered/created/updated/failed`, `error`, czasy)                                                                                     |
| `catalog_ingest`        | surowy rekord (`run_id`, `source_id`, `external_id`, `source_url`, `payload` JSON, `checksum`, `status` `pending/promoted/rejected/duplicate`, `matched_place_id`)                           |
| `catalog_places`        | rekord katalogu - patrz niżej                                                                                                                                                                |
| `catalog_place_sources` | N:N miejsce ↔ źródło (`external_id`, `source_url`, `last_seen_at`) - jedno miejsce bywa w kilku serwisach                                                                                    |
| `place_packs`           | pakiet (`slug`, `name`, `description`, `cover_image_url`, `country_codes`, `status` `draft/published/retired`, `price_minor`, `currency`, `polar_product_id`, `place_count`, `published_at`) |
| `place_pack_places`     | N:N pakiet ↔ miejsce (`sort_order`)                                                                                                                                                          |
| `staff_api_tokens`      | tokeny MCP (`user_id`, `name`, `token_hash`, `last_used_at`, `expires_at`, `revoked_at`) - uprawnienia biorą się z roli właściciela, nie z osobnych scope'ów                                 |

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
znormalizowana nazwa, z `uniqueIndex`. Dodatkowo krotka `PLACE_SOURCES` (`src/server/db/schema.ts`) rozszerzona
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

  | Narzędzie                                                            | Działanie                                         |
  | -------------------------------------------------------------------- | ------------------------------------------------- |
  | `catalog_search_places`                                              | filtry: tekst, kraj, rodzaj, status, bbox; kursor |
  | `catalog_get_place`                                                  | pełny rekord + provenance + historia              |
  | `catalog_upsert_place`                                               | tworzy/aktualizuje, wymusza `dedupe_key`          |
  | `catalog_set_place_status`                                           | `review` / `published` / `retired`                |
  | `catalog_list_ingest` / `catalog_promote_ingest`                     | kolejka surowych rekordów, promocja lub scalenie  |
  | `packs_list` / `packs_create` / `packs_set_places` / `packs_publish` | zarządzanie pakietami                             |
  | `sources_list` / `sources_run`                                       | podgląd źródeł i ręczne uruchomienie przebiegu    |

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

Tabela `shareLinks` (`src/server/db/schema.ts`) ma dziś `trip_id NOT NULL`. Zmień na `resource_kind`
(`trip` / `atlas` / `collection`) + `resource_id`, z `enumCheck` i indeksem
`(resource_kind, resource_id)`. Typ `ShareScopes` (`src/server/db/schema.ts`) rozszerz o wariant atlasowy
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
  - inwalidacja cache uprawnień.
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

Poniższe wywołania są archiwum - Faza 0 i Faza A są już wykonane i ich wiersze zostawiono jako
zapis tego, co zlecono.

```bash
/ultrabuild Faza A: zastąp Stripe przez Polar.sh i usuń Stripe z repo całkowicie - REST przez fetch, webhook HMAC na WebCrypto, Crew jako seat_based, rename kolumn stripe_* na provider_* z migracją, pnpm remove stripe, pnpm add @react-email/components i -D react-email z czterema szablonami billingowymi. Pracuj wg docs/PACKS-PLAN.md §Faza A - produkty w sandboxie już istnieją, ich id są w .env.local
```

```bash
/ultrabuild Faza B: role platformowe Better Auth (admin/curator/user), platform_audit_log i konsola /_app/console. Specyfikacją jest docs/ACCESS.md, a §Faza B tego planu jest indeksem do niej - przeczytaj oba, w tej kolejności
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

Przeczytaj wygenerowany SQL, zanim go zacommitujesz: ma zawierać `ALTER TABLE ... ADD` dla pięciu
kolumn pluginu i `CREATE TABLE platform_audit_log`, a **nie** `__new_user`, `__new_session` ani
`DROP TABLE`. Recreate wymaga wpisu w `docs/DEPLOY.md` §register, zanim gdziekolwiek zostanie
zastosowany.

- Konto z rolą `user` dostaje odmowę na `/console` i na każdej funkcji serwerowej konsoli.
- `curator` widzi katalog, ale nie zakładkę użytkowników i nie może zmienić roli.
- Ban → natychmiastowe wylogowanie (cache ciasteczka wyłączony, decyzja z 23.08) i komunikat
  repo, nie domyślny string Better Autha, przy próbie logowania.
- Impersonacja → pasek ostrzegawczy widoczny na każdym ekranie `/_app`, wpis w
  `platform_audit_log`, sesja wygasa po **900 s** a nie 3600, „zakończ" wraca do konta
  administratora. Każda mutacja konsoli odrzucona przez weto z `ACCESS.md` §6.4.
- Wszystkie 15 ścieżek `/api/auth/admin/*` zwraca **404** przy żywej sesji z rolą `admin`, a
  `grep -rn adminClient src | wc -l` daje `0`.
- Cztery testy drift z `ACCESS.md` są na miejscu: dryf `statement`, nieobecność `adminUserIds`,
  równość `disabledPaths` z listą ścieżek pluginu, i domknięcie sprawdzone od zewnątrz.

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
