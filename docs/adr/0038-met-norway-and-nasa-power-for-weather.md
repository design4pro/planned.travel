# 0038. Weather is read from MET Norway and NASA POWER, chosen because both are free for a commercial product

Status: accepted
Date: 2026-10-08
Issue: #819
Refs: #631 (the decision, taken by the product owner on 2026-09-19), `.ai/specs/2026-09-19-per-day-weather.md`, ADR 0013, ADR 0019

## Context

Per-day weather (`DOC-08`, stage `06-S7` in `docs/plans/06-documents-and-media.md`) has been parked
since the plans were written, as the first of the open commercial decisions of `11-S3` in
`docs/plans/11-boundaries-and-blockers.md`. The reason was never engineering. It was the binding
constraint that file states: a tier whose terms exclude a commercial, subscription-funded product is
unusable to us at any traffic level, and the obvious weather sources are exactly that shape.

The product owner took the decision on 2026-09-19 in #631: the forecast comes from **MET Norway**,
recorded and long-term climate values come from **NASA POWER**, both free, both licensed for commercial
use, and neither needs a key. The spec that builds it, `.ai/specs/2026-09-19-per-day-weather.md`, named
this record 0025. That number was taken by the time the record was written (ADR 0025 is the retirement
of the agent kit), and the directory holds two records numbered 0031, so the number was chosen by the
highest one present, not by the file count. Every plan record that cites this decision cites 0038.

A trip day gets one of three kinds of reading, chosen by how far the day is from today in the trip's
time zone:

| Kind       | Day relative to today                             | Source                                  |
| ---------- | ------------------------------------------------- | --------------------------------------- |
| `forecast` | today up to the last day the forecast covers      | MET Norway Locationforecast 2.0         |
| `recorded` | before today, beyond NASA POWER's publication lag | NASA POWER daily point API              |
| `estimate` | after the forecast's last full day                | NASA POWER climatology (long-term mean) |

`recorded` and `estimate` are the names the badge's accessible name says to a reader. They replace the
`archive` and `climate` that `06-S7` used before this decision, so the glossary matches the product.

## Decision

Read weather from **MET Norway** for the forecast and from **NASA POWER** for recorded and estimated
values, behind our own server-side proxy in `src/server/weather/`, on the same shape as ADR 0013 and
ADR 0019. The browser never calls either provider.

Two properties decided it, each read on the providers' own pages on **2026-09-19** and not taken from a
summary:

1. **Commercial use is allowed.** MET Norway publishes Locationforecast under CC BY 4.0 with commercial
   use allowed. NASA POWER has no restriction on use, including commercial use, and asks to be cited.
2. **No key, no bill.** Neither provider issues a credential or charges, so there is no secret to hold,
   no per-tenant credential to refuse (ADR 0019) and no recurring cost to add to the model in
   `docs/ARCHITECTURE.md` section 8.

### The terms we are bound to

Read on 2026-09-19. A change to either set of terms is handled by a new record, and the vendor clients
are the only code that changes.

**MET Norway** (CC BY 4.0, commercial use allowed):

- A `User-Agent` that identifies the application and gives a contact. A request without one is answered
  with 403.
- Responses are cached, and `Expires` and `If-Modified-Since` are honoured.
- Coordinates are truncated to at most four decimals (NASA POWER is sent one; see the Amendment).
- At most 20 requests per second per application, spread out rather than simultaneous.
- HTTPS and gzip. The Workers runtime negotiates gzip on every outbound `fetch`, so no `Accept-Encoding`
  header is set by hand.
- Attribution is shown on screen.

**NASA POWER:**

- No restriction on use, including commercial use. The data is to be cited.
- The grid is roughly 0.5 degrees. Near-real-time values settle into climate-quality values after two
  to three months, and the fill value for missing data is `-999`.

### What each provider receives, and what it may do with it

The only tenant data a provider receives is **a trip coordinate, truncated to four decimals** (about
11 m; one decimal for NASA POWER, see the Amendment), taken from a place the trip already holds. Neither request carries a trip id, a place id, a
workspace id, a member id, a name or a note. The date or date range asked for is the second thing a
provider learns, and with the coordinate it is the whole of the disclosure.

| Provider   | Receives                                                                        | May do with it                                                                                                                                                            | For how long                                                                                                |
| ---------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| MET Norway | Coordinate (four decimals), date range, our `User-Agent`, Worker egress address | Answer the request. The terms require the `User-Agent` to identify the application and give a contact. They set no use of the request beyond that, and none is relied on. | The terms as read state no retention period for request logs. We rely on none and assume the logs are kept. |
| NASA POWER | Coordinate (one decimal), date range, Worker egress address                     | Answer the request. The terms place no restriction on our use of what it returns, and none is relied on for what it does with the request.                                | The terms as read state no retention period for request logs. We rely on none and assume the logs are kept. |

Because a provider may keep a request log for as long as it likes, the rule is about what we send, not
about what they delete: the truncation (four decimals, one for NASA POWER) is applied before the request is built and before
the cache key is built, and nothing else about the trip, the workspace or the traveller is attached.

What we may keep is the other half of the retention question, and it is the one that decided ADR 0013.
Here it is not binding: MET Norway asks us to cache and to honour `Expires`, and NASA POWER places no
limit on caching. A reading is a public fact about a place and a day, so it is cached in the existing
`KV` namespace under a key that carries a coordinate and a date and no tenant data, and one workspace's
fetch legitimately answers another's. The key shapes and lifetimes are the spec's to define, and a forecast
is never served past its `Expires` without asking MET Norway first.

### Constraints that come with it

- **Attribution is not optional.** MET Norway is credited as `Forecast data: MET Norway, CC BY 4.0` and
  NASA POWER as `Data: NASA Langley Research Center POWER Project`, on the surface that shows the
  reading.
- **An estimate is never shown as a forecast.** An `estimate` carries a visible marker and an accessible
  name that says so. A reading that is missing renders as missing, never as an invented number.
- **Outbound calls are metered per workspace** in `resolveLimits()` like transit, extraction and
  geocoding, because a call made on one workspace's behalf costs every other workspace its share of
  MET Norway's per-application rate cap.
- **Units are metric in storage and converted at render**, coupled to the reader's existing
  `distance_unit`. This closes the temperature-unit deferral of `09-S8` as "no separate preference",
  not as "later".

## Consequences

`DOC-08` loses its blocker and `06-S7` becomes buildable, in three phases the spec defines: this record
(docs only), the server, and the surface. The weather register row and the provider-decision entry in
`docs/plans/11-boundaries-and-blockers.md` are struck through and cite this record, the way geocoding
cites ADR 0013. `docs/plans/09-account-and-settings.md` closes its temperature-unit row.

We now hold two more outbound vendors, and the provider-decision register has one open decision left:
foreign-exchange rates.

The cost is two sets of terms to keep honouring in code. The vendor clients carry the `User-Agent`, the
coordinate truncation and the `Expires` handling, and a test per client holds each of them in place. If
either provider changes its terms in a way that excludes commercial use, this record is superseded by a
new one; the policy module and the surface do not change.

## Alternatives rejected

- **Open-Meteo free API.** The reference product's source, with forecast, archive and climate behind one
  API. Refused by its own terms: the free tier is for non-commercial use, and we charge for subscriptions
  through Stripe.
- **Open-Meteo commercial subscription.** The same capability without the clause, but a recurring bill.
  Once the two free sources cover the need, the budget in `docs/ARCHITECTURE.md` section 8 does not
  justify it.
- **Meteostat.** Licensed CC BY-NC, excluded by the same non-commercial clause.
- **An estimate from the same date a year earlier**, as `06-S7` first sketched. One year is one sample,
  so a freak day becomes the estimate. The long-term monthly mean is what a traveller packing for next
  spring needs.
- **Keeping the block.** A trip planner with no weather leaves a traveller to find it elsewhere, and the
  block existed only for want of a licence we have now read.

## Amendment (#823, the recorded kind)

NASA POWER is sent a coordinate cut to **one decimal** (about 11 km), not four. Its grid is about
0.5 degrees, so a finer coordinate buys no better answer and would only tell the vendor more than the
answer needs; the recorded cache key and the failure entry carry the same one-decimal coordinate, so
two places in one cell share a reading. The truncation is applied before the request and the key are
built, as the rule above requires, and a test of the request URL holds it. The table above states the
disclosure as built.

The publication lag is measured, not assumed: on 2026-10-12 at 11:42 and again at 12:09 UTC the service
held values through 2026-10-09 and the fill value (`-999`) for 10, 11 and 12 October at six locations on
five continents, so `POWER_LAG_DAYS` is 3 and a date is published once it is three or more days before
today in UTC.
