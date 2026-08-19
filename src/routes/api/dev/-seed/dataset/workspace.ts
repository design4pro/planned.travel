/**
 * Workspace-level demo data: the people, the taxonomy the places hang off, and the four
 * traveller-level surfaces that are not scoped to one trip — atlas, journal, collections and vacay —
 * plus the inbox and the audit trail.
 *
 * Two sentinel param values are understood by the applier and documented on
 * {@link import('../types').SeedNotification}: `@daysUntilTripStart` becomes the whole number of days
 * from today to the referenced trip's start date, and `@organizationName` becomes the workspace name.
 * They exist so the copy stays correct however long after the seed date it is read.
 */

import type {
  SeedAuditEntry,
  SeedBucketListItem,
  SeedCategory,
  SeedCollection,
  SeedJourney,
  SeedNotification,
  SeedPerson,
  SeedTravelStats,
  SeedVacay,
  SeedVisitedCountry,
  SeedVisitedRegion,
} from '../types'

/**
 * `rafal` is the account that already exists and is resolved by email; the other three are created
 * as workspace members so splits, assignments, votes and chat have real names behind them.
 */
export const people: ReadonlyArray<SeedPerson> = [
  { key: 'rafal', name: 'Rafal Wolak', email: 'rafal@planned.travel', role: 'owner', colour: '#2F6F5E' },
  { key: 'mika', name: 'Mika Tanaka', email: 'mika@planned.travel', role: 'admin', colour: '#C0392B' },
  { key: 'jonas', name: 'Jonas Berg', email: 'jonas@planned.travel', role: 'member', colour: '#2563EB' },
  { key: 'priya', name: 'Priya Raman', email: 'priya@planned.travel', role: 'member', colour: '#B26B08' },
]

/** Added on top of the eight `ensureDefaultCategories` slugs, which the places also use. */
export const extraCategories: ReadonlyArray<SeedCategory> = [
  { name: 'Temples & shrines', slug: 'temples-and-shrines', icon: 'church', colour: '#8A5A2B', sortOrder: 9 },
  { name: 'Markets', slug: 'markets', icon: 'store', colour: '#0F766E', sortOrder: 10 },
]

/* -------------------------------------------------------------------------------------------------
 * Atlas
 * ---------------------------------------------------------------------------------------------- */

export const visitedCountries: ReadonlyArray<SeedVisitedCountry> = [
  {
    countryCode: 'GB',
    continent: 'Europe',
    visits: ['2010-03-19'],
    note: 'Home. Counted once, for the map.',
  },
  {
    countryCode: 'FR',
    continent: 'Europe',
    visits: ['2011-07-14', '2018-05-20', '2024-09-06'],
    note: 'Paris twice, then the Verdon gorge with the climbing club.',
  },
  {
    countryCode: 'IT',
    continent: 'Europe',
    visits: ['2013-06-01', '2026-06-13'],
    note: 'Rome as a student, then the Dolomites properly.',
  },
  { countryCode: 'ES', continent: 'Europe', visits: ['2015-04-11'] },
  {
    countryCode: 'PT',
    continent: 'Europe',
    visits: ['2019-09-21', '2026-08-17'],
    note: 'Porto first, Lisbon this month.',
  },
  {
    countryCode: 'IS',
    continent: 'Europe',
    visits: ['2022-02-05'],
    note: 'Ring road in February. Do not recommend the ring road in February.',
  },
  { countryCode: 'AT', continent: 'Europe', visits: ['2023-12-28'] },
  {
    countryCode: 'JP',
    continent: 'Asia',
    visits: ['2019-04-02'],
    note: 'Ten days in Tokyo for work, three of them actually looking around.',
  },
  { countryCode: 'TH', continent: 'Asia', visits: ['2017-11-08'] },
  {
    countryCode: 'MA',
    continent: 'Africa',
    visits: ['2025-11-08'],
    note: 'A week in the medina, mostly on the roof.',
  },
  {
    countryCode: 'US',
    continent: 'North America',
    visits: ['2016-08-14', '2023-03-02'],
    note: 'Utah and then New York in the snow.',
  },
  {
    countryCode: 'AR',
    continent: 'South America',
    visits: ['2021-12-04'],
    note: 'Buenos Aires only. Patagonia is still on the list.',
  },
]

export const visitedRegions: ReadonlyArray<SeedVisitedRegion> = [
  { countryCode: 'JP', regionCode: 'JP-13', regionName: 'Tokyo', visitedOn: '2019-04-02' },
  { countryCode: 'IT', regionCode: 'IT-BZ', regionName: 'South Tyrol', visitedOn: '2026-06-13' },
  { countryCode: 'IT', regionCode: 'IT-RM', regionName: 'Lazio', visitedOn: '2013-06-01' },
  { countryCode: 'PT', regionCode: 'PT-11', regionName: 'Lisbon', visitedOn: '2026-08-17' },
  { countryCode: 'PT', regionCode: 'PT-13', regionName: 'Porto', visitedOn: '2019-09-21' },
  { countryCode: 'FR', regionCode: 'FR-75', regionName: 'Paris', visitedOn: '2011-07-14' },
  { countryCode: 'US', regionCode: 'US-NY', regionName: 'New York', visitedOn: '2023-03-02' },
  { countryCode: 'US', regionCode: 'US-UT', regionName: 'Utah', visitedOn: '2016-08-14' },
  { countryCode: 'MA', regionCode: 'MA-07', regionName: 'Marrakech-Safi', visitedOn: '2025-11-08' },
]

export const bucketList: ReadonlyArray<SeedBucketListItem> = [
  {
    kind: 'place',
    name: 'Ryoan-ji rock garden, alone at opening',
    countryCode: 'JP',
    lat: 35.0345,
    lng: 135.7183,
    note: 'Fifteen stones, and you can never see all of them at once. Gates open 08:00.',
    targetYear: 2026,
    sortOrder: 1,
  },
  {
    kind: 'region',
    name: 'Torres del Paine — the full O circuit',
    countryCode: 'CL',
    lat: -50.9423,
    lng: -73.4068,
    note: 'Eight days, camping. Hinges on the February ferry timetable.',
    targetYear: 2027,
    sortOrder: 2,
  },
  {
    kind: 'place',
    name: 'Fitz Roy at sunrise from Laguna de los Tres',
    countryCode: 'AR',
    lat: -49.2717,
    lng: -73.0464,
    note: 'Leave El Chaltén at 03:00. The last kilometre is the whole climb.',
    targetYear: 2027,
    sortOrder: 3,
  },
  {
    kind: 'place',
    name: 'Night train from Vienna to Rome',
    countryCode: 'AT',
    lat: 48.1856,
    lng: 16.3776,
    note: 'Nightjet 40294. Book the two-berth compartment, not the couchette.',
    targetYear: 2027,
    sortOrder: 4,
  },
  {
    kind: 'country',
    name: 'Iceland in winter, for the aurora',
    countryCode: 'IS',
    note: 'February again, but this time only the south coast and no ring road.',
    targetYear: 2028,
    sortOrder: 5,
  },
  {
    kind: 'country',
    name: 'Georgia — Svaneti in September',
    countryCode: 'GE',
    note: 'Mestia to Ushguli, four days, guesthouses the whole way.',
    targetYear: 2028,
    sortOrder: 6,
  },
  {
    kind: 'place',
    name: 'Tre Cime di Lavaredo loop',
    countryCode: 'IT',
    lat: 46.6183,
    lng: 12.3055,
    note: 'Ten kilometres anticlockwise so the north faces stay in front of you.',
    achievedOn: '2026-06-18',
    sortOrder: 7,
  },
  {
    kind: 'place',
    name: 'Lago di Braies before the crowds',
    countryCode: 'IT',
    lat: 46.6947,
    lng: 12.0855,
    note: 'On the water at 06:15. Second in the queue for the boathouse.',
    achievedOn: '2026-06-16',
    sortOrder: 8,
  },
  {
    kind: 'country',
    name: 'Morocco',
    countryCode: 'MA',
    note: 'A week inside the medina walls. Done, and going back.',
    achievedOn: '2025-11-08',
    sortOrder: 9,
  },
]

/** Distance and streak are the two figures `recomputeTravelStats` cannot derive from the trips. */
export const travelStats: ReadonlyArray<SeedTravelStats> = [
  { statYear: 0, distanceMetres: 128_400_000, yearStreak: 7 },
  { statYear: 2026, distanceMetres: 25_640_000, yearStreak: 7 },
  { statYear: 2025, distanceMetres: 4_580_000, yearStreak: 6 },
]

/* -------------------------------------------------------------------------------------------------
 * Journal
 * ---------------------------------------------------------------------------------------------- */

export const journeys: ReadonlyArray<SeedJourney> = [
  {
    slug: 'dolomites-hut-to-hut',
    title: 'Ninety-four kilometres of limestone',
    subtitle: 'Eight days in the Dolomites, mostly above the treeline',
    description:
      'Written up from a notebook that got rained on twice. Two entries survived legibly, which is ' +
      'probably the right number.',
    coverGradient: 'linear-gradient(135deg, #16794C 0%, #2F6F5E 55%, #131311 100%)',
    tripSlug: 'dolomites-hut-to-hut',
    startedOn: '2026-06-13',
    endedOn: '2026-06-20',
    entries: [
      {
        type: 'note',
        moodKey: 'awed',
        title: 'Six-fifteen at Braies',
        body:
          'We set the alarm for half four on the assumption that everyone else would too, and they had ' +
          'not. The car park was empty except for a man asleep across the front seats of a Fiat, and the ' +
          'lake was doing the thing it does in photographs — that flat, impossible green — except with ' +
          'nobody in front of it.\n\n' +
          'Mika got the boathouse to herself for forty minutes. I walked the east shore instead and found ' +
          'the point where the scree comes right down to the water and you can hear it settling. By nine ' +
          'the first coach had arrived and it was a completely different place, so we left.\n\n' +
          'Rule for the rest of the week: everything worth seeing is worth seeing at six.',
        entryDate: '2026-06-16',
        entryTime: '06:15',
        locationName: 'Lago di Braies, South Tyrol',
        lat: 46.6947,
        lng: 12.0855,
        weather: 'Clear, mist on the water',
        temperatureCelsius: 7.5,
        tags: ['dolomites', 'lake', 'early start'],
        sortOrder: 1,
        photos: [
          {
            storageKey: 'demo/journeys/dolomites/braies-boathouse.jpg',
            thumbnailKey: 'demo/journeys/dolomites/braies-boathouse-thumb.jpg',
            caption: 'The boathouse at 06:20, before anyone else arrived.',
            contentType: 'image/jpeg',
            sizeBytes: 3_284_112,
            width: 4_032,
            height: 3_024,
          },
        ],
      },
      {
        type: 'milestone',
        moodKey: 'weary',
        title: 'The loop, anticlockwise',
        body:
          'Ten kilometres, four hundred and twenty metres of ascent, and the whole afternoon with the ' +
          'north faces in front of us — which is the entire argument for walking it anticlockwise and ' +
          'nobody at the hut disagreed.\n\n' +
          'Jonas counted two hundred photographs of the same three rocks and he is not wrong, but the ' +
          'light moved about four times between Lavaredo and Locatelli and each one looked like a ' +
          'different mountain. We ate at seven with about thirty other people, all of whom had walked in, ' +
          'and the dining room smelled entirely of wet socks.\n\n' +
          'Ticked it off the list on the way down. Six years since I first wrote it in the notebook.',
        entryDate: '2026-06-18',
        entryTime: '19:40',
        locationName: 'Rifugio Locatelli, Sesto',
        lat: 46.6244,
        lng: 12.3006,
        weather: 'High cloud, cold wind on the col',
        temperatureCelsius: 4,
        tags: ['dolomites', 'tre cime', 'rifugio', 'bucket list'],
        sortOrder: 2,
        photos: [
          {
            storageKey: 'demo/journeys/dolomites/tre-cime-north-faces.jpg',
            thumbnailKey: 'demo/journeys/dolomites/tre-cime-north-faces-thumb.jpg',
            caption: 'North faces from the path below Locatelli, about half five.',
            contentType: 'image/jpeg',
            sizeBytes: 4_112_880,
            width: 4_032,
            height: 3_024,
          },
        ],
      },
    ],
  },
  {
    slug: 'marrakech-riad-week',
    title: 'A week on a roof in Marrakech',
    subtitle: 'Seven nights inside the medina walls, November 2025',
    description: 'One entry, written on the last morning, before the taxi.',
    coverGradient: 'linear-gradient(135deg, #C0392B 0%, #B26B08 60%, #131311 100%)',
    tripSlug: 'marrakech-riad-week',
    startedOn: '2025-11-08',
    endedOn: '2025-11-15',
    entries: [
      {
        type: 'note',
        moodKey: 'calm',
        title: 'The last morning',
        body:
          'Seven days and I never once found the same way back to the riad. Mika worked it out on the ' +
          'third afternoon and stopped telling me, which was the correct decision.\n\n' +
          'The thing nobody says about the medina is how quiet it is at six. The souks are shuttered, the ' +
          'cats own the derbs, and the only sound is someone hosing down a step. By eight it is the ' +
          'loudest place I have ever stood in.\n\n' +
          'Best meal of the week was stall 14 on the square, eaten standing at the counter for the ' +
          'equivalent of four pounds. The most expensive thing we bought was a kilim we were ' +
          'comprehensively out-negotiated on, and it is on the floor of the front room now, so.',
        entryDate: '2025-11-15',
        entryTime: '06:40',
        locationName: 'Riad Yasmine, Medina, Marrakech',
        lat: 31.6295,
        lng: -7.9906,
        weather: 'Cool and clear, call to prayer',
        temperatureCelsius: 14,
        tags: ['marrakech', 'medina', 'last day'],
        sortOrder: 1,
      },
    ],
  },
]

/* -------------------------------------------------------------------------------------------------
 * Collections — saved places that are not on any trip yet
 * ---------------------------------------------------------------------------------------------- */

export const collections: ReadonlyArray<SeedCollection> = [
  {
    slug: 'kyoto-next-time',
    name: 'Kyoto, next time',
    description: 'Everything that did not fit into twelve days. Ordered roughly north to south.',
    colour: '#8A5A2B',
    icon: 'bookmark',
    visibility: 'organization',
    labels: [
      { name: 'Temple', colour: '#8A5A2B' },
      { name: 'Walk', colour: '#16794C' },
      { name: 'Food', colour: '#B26B08' },
    ],
    places: [
      {
        name: 'Ryoan-ji',
        categorySlug: 'temples-and-shrines',
        description: 'The rock garden. Fifteen stones, arranged so you can never see all fifteen at once.',
        notes: 'Opens 08:00 in October. Combine with Kinkaku-ji, they are one bus stop apart.',
        lat: 35.0345,
        lng: 135.7183,
        address: '13 Ryoanji Goryonoshitacho, Ukyo Ward, Kyoto 616-8001',
        city: 'Kyoto',
        countryCode: 'JP',
        website: 'https://ryoanji.jp',
        status: 'shortlisted',
        labels: ['Temple'],
        sortOrder: 1,
      },
      {
        name: 'Kifune Shrine',
        categorySlug: 'temples-and-shrines',
        description: 'Lantern staircase up through cedar, an hour north of the city on the Eizan line.',
        lat: 35.1216,
        lng: 135.7626,
        address: '180 Kuramakibunecho, Sakyo Ward, Kyoto 601-1112',
        city: 'Kyoto',
        countryCode: 'JP',
        status: 'idea',
        labels: ['Temple', 'Walk'],
        sortOrder: 2,
      },
      {
        name: 'Kurama-dera to Kibune walk',
        categorySlug: 'outdoors',
        description: 'Two hours over the ridge between two shrines. Steep, rooty, almost empty.',
        lat: 35.1174,
        lng: 135.7708,
        address: '1074 Kuramahonmachi, Sakyo Ward, Kyoto 601-1111',
        city: 'Kyoto',
        countryCode: 'JP',
        status: 'shortlisted',
        labels: ['Walk'],
        sortOrder: 3,
      },
      {
        name: 'Nanzen-ji aqueduct',
        categorySlug: 'temples-and-shrines',
        description: 'Meiji-era brick aqueduct running straight through a Zen temple complex.',
        notes: 'Southern end of the Philosopher’s Path, so it is genuinely five minutes off our route.',
        lat: 35.0114,
        lng: 135.7942,
        address: '86 Nanzenji Fukuchicho, Sakyo Ward, Kyoto 606-8435',
        city: 'Kyoto',
        countryCode: 'JP',
        status: 'planned',
        labels: ['Temple', 'Walk'],
        sortOrder: 4,
      },
      {
        name: 'Tofuku-ji',
        categorySlug: 'temples-and-shrines',
        description: 'The maple valley under the Tsutenkyo bridge. Peak colour is the last week of November.',
        notes: 'Too early for us in October — this is a November trip.',
        lat: 34.9766,
        lng: 135.7742,
        address: '15-778 Honmachi, Higashiyama Ward, Kyoto 605-0981',
        city: 'Kyoto',
        countryCode: 'JP',
        status: 'idea',
        labels: ['Temple'],
        sortOrder: 5,
      },
      {
        name: 'Sanjusangendo',
        categorySlug: 'temples-and-shrines',
        description: 'One hundred and twenty metres of hall, and one thousand and one carved Kannon.',
        lat: 34.9879,
        lng: 135.7719,
        address: '657 Sanjusangendomawari, Higashiyama Ward, Kyoto 605-0941',
        city: 'Kyoto',
        countryCode: 'JP',
        status: 'shortlisted',
        labels: ['Temple'],
        sortOrder: 6,
      },
      {
        name: 'Nishiki Warai — the Gion branch',
        categorySlug: 'food-and-drink',
        description: 'Same okonomiyaki, quieter room, and it takes bookings after 20:00.',
        lat: 35.0035,
        lng: 135.7746,
        address: '570-127 Gionmachi Minamigawa, Higashiyama Ward, Kyoto 605-0074',
        city: 'Kyoto',
        countryCode: 'JP',
        status: 'idea',
        labels: ['Food'],
        sortOrder: 7,
      },
      {
        name: 'Kichi Kichi Omurice',
        categorySlug: 'food-and-drink',
        description: 'Eight seats, one dish, a performance. Bookings open two months ahead and go in a day.',
        notes: 'Set a calendar reminder for the first of the month, two months out.',
        lat: 35.0087,
        lng: 135.7695,
        address: '185-4 Zaimokucho, Nakagyo Ward, Kyoto 604-8017',
        city: 'Kyoto',
        countryCode: 'JP',
        status: 'rejected',
        labels: ['Food'],
        sortOrder: 8,
      },
    ],
  },
  {
    slug: 'lisbon-eating',
    name: 'Lisbon — where to eat',
    description: 'Built from three trips and two arguments. Anything marked visited we would go back to.',
    colour: '#B26B08',
    icon: 'utensils',
    visibility: 'organization',
    labels: [
      { name: 'Booked ahead', colour: '#2563EB' },
      { name: 'Walk in', colour: '#16794C' },
      { name: 'Splurge', colour: '#C0392B' },
    ],
    places: [
      {
        name: 'Cervejaria Ramiro',
        categorySlug: 'food-and-drink',
        description: 'Shellfish, beer, paper tablecloths. The steak sandwich is dessert, not a joke.',
        notes: 'Book, or queue from 18:30. They do not hold tables past fifteen minutes.',
        lat: 38.7208,
        lng: -9.1358,
        address: 'Av. Almirante Reis 1, 1150-007 Lisbon',
        city: 'Lisbon',
        countryCode: 'PT',
        status: 'visited',
        labels: ['Booked ahead'],
        sortOrder: 1,
      },
      {
        name: 'Taberna da Rua das Flores',
        categorySlug: 'food-and-drink',
        description: 'Twenty covers, blackboard menu, changes daily. No bookings, ever.',
        lat: 38.7101,
        lng: -9.1425,
        address: 'R. das Flores 103, 1200-194 Lisbon',
        city: 'Lisbon',
        countryCode: 'PT',
        status: 'shortlisted',
        labels: ['Walk in'],
        sortOrder: 2,
      },
      {
        name: 'O Velho Eurico',
        categorySlug: 'food-and-drink',
        description: 'Tasca cooking done seriously — offal, bread soups, and a very short wine list.',
        lat: 38.7126,
        lng: -9.1329,
        address: 'Largo de São Cristóvão 3, 1100-241 Lisbon',
        city: 'Lisbon',
        countryCode: 'PT',
        status: 'planned',
        labels: ['Walk in'],
        sortOrder: 3,
      },
      {
        name: 'A Cevicheria',
        categorySlug: 'food-and-drink',
        description: 'Peruvian, one giant octopus on the ceiling, and a queue that starts at the door.',
        lat: 38.7157,
        lng: -9.1509,
        address: 'R. Dom Pedro V 129, 1250-096 Lisbon',
        city: 'Lisbon',
        countryCode: 'PT',
        status: 'idea',
        labels: ['Walk in'],
        sortOrder: 4,
      },
      {
        name: 'Belcanto',
        categorySlug: 'food-and-drink',
        description: 'Two Michelin stars, tasting menu only. Book eight weeks out and dress for it.',
        lat: 38.7104,
        lng: -9.1424,
        address: 'R. Serpa Pinto 10A, 1200-445 Lisbon',
        city: 'Lisbon',
        countryCode: 'PT',
        status: 'idea',
        labels: ['Booked ahead', 'Splurge'],
        sortOrder: 5,
      },
      {
        name: 'Manteigaria',
        categorySlug: 'food-and-drink',
        description: 'The other pastel de nata. Standing counter, cinnamon on top, still hot.',
        lat: 38.7107,
        lng: -9.1449,
        address: 'R. do Loreto 2, 1200-108 Lisbon',
        city: 'Lisbon',
        countryCode: 'PT',
        status: 'visited',
        labels: ['Walk in'],
        sortOrder: 6,
      },
      {
        name: 'Time Out Market Lisboa',
        categorySlug: 'markets',
        description: 'Twenty-six kitchens under one roof. Best before 12:30 or after 21:00.',
        lat: 38.7071,
        lng: -9.1459,
        address: 'Av. 24 de Julho 49, 1200-479 Lisbon',
        city: 'Lisbon',
        countryCode: 'PT',
        status: 'visited',
        labels: ['Walk in'],
        sortOrder: 7,
      },
    ],
  },
]

/* -------------------------------------------------------------------------------------------------
 * Vacay
 * ---------------------------------------------------------------------------------------------- */

export const vacay: SeedVacay = {
  name: 'Wolak household',
  defaultEntitlementDays: 28,
  years: [2025, 2026],
  entitlements: [
    { person: 'rafal', year: 2026, entitlementDays: 28, carriedOverDays: 3 },
    { person: 'mika', year: 2026, entitlementDays: 25, carriedOverDays: 0 },
    { person: 'jonas', year: 2026, entitlementDays: 30, carriedOverDays: 2 },
    { person: 'priya', year: 2026, entitlementDays: 26, carriedOverDays: 1 },
    { person: 'rafal', year: 2025, entitlementDays: 28, carriedOverDays: 0 },
  ],
  calendars: [
    { region: 'GB-ENG', label: 'England & Wales', colour: '#C0392B', sortOrder: 1 },
    { region: 'JP', label: 'Japan', colour: '#2F6F5E', sortOrder: 2 },
    { region: 'PT', label: 'Portugal', colour: '#B26B08', sortOrder: 3 },
  ],
  companyHolidays: [
    { date: '2026-01-02', label: 'Office closed — New Year' },
    { date: '2026-05-26', label: 'Company away day' },
    { date: '2026-08-31', label: 'Summer closure' },
    { date: '2026-12-24', label: 'Christmas Eve — office closed' },
    { date: '2026-12-31', label: 'New Year’s Eve — office closed' },
  ],
  entries: [
    { person: 'rafal', from: '2026-03-11', to: '2026-03-11', kind: 'sick', note: 'Flu.' },
    { person: 'rafal', from: '2026-05-08', to: '2026-05-08', kind: 'half_day', note: 'Afternoon off for the passport appointment.' },
    { person: 'rafal', from: '2026-06-15', to: '2026-06-19', kind: 'vacation', note: 'Dolomites.' },
    { person: 'rafal', from: '2026-08-17', to: '2026-08-21', kind: 'vacation', note: 'Lisbon.' },
    { person: 'rafal', from: '2026-09-02', to: '2026-09-04', kind: 'remote', note: 'Working from the cottage.' },
    { person: 'rafal', from: '2026-10-09', to: '2026-10-09', kind: 'vacation', note: 'Japan — travel day.' },
    { person: 'rafal', from: '2026-10-12', to: '2026-10-16', kind: 'vacation', note: 'Japan.' },
    { person: 'rafal', from: '2026-10-19', to: '2026-10-20', kind: 'vacation', note: 'Japan — Osaka and home.' },

    { person: 'mika', from: '2026-04-06', to: '2026-04-10', kind: 'vacation', note: 'Family, Osaka.' },
    { person: 'mika', from: '2026-06-15', to: '2026-06-19', kind: 'vacation', note: 'Dolomites.' },
    { person: 'mika', from: '2026-10-09', to: '2026-10-09', kind: 'vacation', note: 'Japan — travel day.' },
    { person: 'mika', from: '2026-10-12', to: '2026-10-16', kind: 'vacation', note: 'Japan.' },
    { person: 'mika', from: '2026-10-19', to: '2026-10-20', kind: 'vacation', note: 'Japan — Osaka and home.' },

    { person: 'jonas', from: '2026-06-15', to: '2026-06-19', kind: 'vacation', note: 'Dolomites.' },
    { person: 'jonas', from: '2026-07-20', to: '2026-07-22', kind: 'remote', note: 'Client site, Copenhagen.' },
    { person: 'jonas', from: '2026-10-09', to: '2026-10-09', kind: 'vacation', note: 'Japan — travel day.' },
    { person: 'jonas', from: '2026-10-12', to: '2026-10-16', kind: 'vacation', note: 'Japan.' },
    { person: 'jonas', from: '2026-10-19', to: '2026-10-20', kind: 'vacation', note: 'Japan — Osaka and home.' },

    { person: 'priya', from: '2026-08-17', to: '2026-08-21', kind: 'vacation', note: 'Lisbon.' },
    { person: 'priya', from: '2026-10-09', to: '2026-10-09', kind: 'vacation', note: 'Japan — travel day.' },
    { person: 'priya', from: '2026-10-12', to: '2026-10-16', kind: 'vacation', note: 'Japan.' },
    { person: 'priya', from: '2026-10-19', to: '2026-10-20', kind: 'vacation', note: 'Japan — Osaka and home.' },
  ],
}

/* -------------------------------------------------------------------------------------------------
 * Inbox and audit trail
 * ---------------------------------------------------------------------------------------------- */

export const notifications: ReadonlyArray<SeedNotification> = [
  {
    key: 'notif-starting-soon',
    sender: 'mika',
    type: 'navigate',
    scope: 'trip',
    titleKey: 'trip.starting_soon',
    titleParams: { tripTitle: 'Tokyo & Kyoto', days: '@daysUntilTripStart' },
    bodyKey: 'trip.starting_soon',
    bodyParams: { tripTitle: 'Tokyo & Kyoto', days: '@daysUntilTripStart' },
    entityType: 'trip',
    entityTripSlug: 'tokyo-and-kyoto',
    minutesAgo: 95,
    isRead: false,
  },
  {
    key: 'notif-unclaimed',
    sender: 'mika',
    type: 'info',
    scope: 'trip',
    titleKey: 'collab.message',
    titleParams: { actorName: 'Mika Tanaka', tripTitle: 'Tokyo & Kyoto' },
    bodyKey: 'collab.message',
    bodyParams: {
      actorName: 'Mika Tanaka',
      tripTitle: 'Tokyo & Kyoto',
      preview: 'One unclaimed receipt on the costs tab — 4,800 yen SIM top-up.',
    },
    entityType: 'trip',
    entityTripSlug: 'tokyo-and-kyoto',
    minutesAgo: 180,
    isRead: false,
  },
  {
    key: 'notif-assigned',
    sender: 'priya',
    type: 'navigate',
    scope: 'trip',
    titleKey: 'list.assigned',
    titleParams: { actorName: 'Priya Raman' },
    bodyKey: 'list.assigned',
    bodyParams: { title: 'Insurance policy card', tripTitle: 'Tokyo & Kyoto', actorName: 'Priya Raman' },
    entityType: 'trip',
    entityTripSlug: 'tokyo-and-kyoto',
    minutesAgo: 700,
    isRead: false,
  },
  {
    key: 'notif-settled',
    sender: 'jonas',
    type: 'info',
    scope: 'trip',
    titleKey: 'expense.settled',
    titleParams: { actorName: 'Jonas Berg' },
    bodyKey: 'expense.settled',
    bodyParams: { actorName: 'Jonas Berg', tripTitle: 'Tokyo & Kyoto' },
    entityType: 'trip',
    entityTripSlug: 'tokyo-and-kyoto',
    minutesAgo: 655,
    isRead: true,
  },
  {
    key: 'notif-expense',
    sender: 'priya',
    type: 'info',
    scope: 'trip',
    titleKey: 'expense.added',
    titleParams: { actorName: 'Priya Raman' },
    bodyKey: 'expense.added',
    bodyParams: {
      actorName: 'Priya Raman',
      title: 'Osaka Castle and Nishinomaru Garden × 3',
      tripTitle: 'Tokyo & Kyoto',
    },
    entityType: 'trip',
    entityTripSlug: 'tokyo-and-kyoto',
    minutesAgo: 1_420,
    isRead: true,
  },
  {
    key: 'notif-reservation',
    sender: 'mika',
    type: 'navigate',
    scope: 'trip',
    titleKey: 'reservation.reminder',
    titleParams: { title: 'Kyubey Ginza · omakase, counter' },
    bodyKey: 'reservation.reminder',
    bodyParams: { title: 'Kyubey Ginza · omakase, counter', when: '19:00 on Monday 12 October' },
    entityType: 'trip',
    entityTripSlug: 'tokyo-and-kyoto',
    minutesAgo: 4_200,
    isRead: true,
  },
  {
    key: 'notif-plan',
    sender: 'rafal',
    type: 'info',
    scope: 'organization',
    titleKey: 'billing.plan_changed',
    titleParams: { organizationName: '@organizationName', plan: 'pro' },
    bodyKey: 'billing.plan_changed',
    bodyParams: { organizationName: '@organizationName', plan: 'pro' },
    minutesAgo: 43_200,
    isRead: true,
  },
]

export const auditTrail: ReadonlyArray<SeedAuditEntry> = [
  {
    action: 'billing.plan_changed',
    entityType: 'subscription',
    // Matches the subscription the seed actually writes — see `dataset/index.ts`.
    metadata: { from: 'free', to: 'crew', seats: 10 },
    minutesAgo: 43_200,
  },
  {
    action: 'member.added',
    entityType: 'member',
    metadata: { email: 'mika@planned.travel', role: 'admin' },
    minutesAgo: 43_000,
  },
  {
    action: 'trip.created',
    entityType: 'trip',
    entityTripSlug: 'tokyo-and-kyoto',
    metadata: { title: 'Tokyo & Kyoto', days: 12 },
    minutesAgo: 20_000,
  },
  {
    action: 'reservation.confirmed',
    entityType: 'reservation',
    entityTripSlug: 'tokyo-and-kyoto',
    metadata: { title: 'The Thousand Kyoto', nights: 5 },
    minutesAgo: 9_400,
  },
  {
    action: 'journey.published',
    entityType: 'journey',
    entityTripSlug: 'dolomites-hut-to-hut',
    metadata: { title: 'Ninety-four kilometres of limestone', entries: 2 },
    minutesAgo: 88_000,
  },
  {
    action: 'trip.archived',
    entityType: 'trip',
    entityTripSlug: 'marrakech-riad-week',
    metadata: { title: 'Marrakech riad week', reason: 'written up' },
    minutesAgo: 390_000,
  },
  {
    action: 'expense.created',
    entityType: 'expense',
    entityTripSlug: 'tokyo-and-kyoto',
    metadata: { title: 'Currency exchange fee · 400,000 yen cash', amountMinor: 6_000 },
    minutesAgo: 1_400,
  },
]

/** In-app on for everything, email for the ones worth an email, push off. */
export const notificationPreferences: ReadonlyArray<{
  readonly eventType: string
  readonly channel: 'in_app' | 'email' | 'push'
  readonly isEnabled: boolean
}> = [
  { eventType: 'trip.invited', channel: 'in_app', isEnabled: true },
  { eventType: 'trip.invited', channel: 'email', isEnabled: true },
  { eventType: 'trip.updated', channel: 'in_app', isEnabled: true },
  { eventType: 'trip.updated', channel: 'email', isEnabled: false },
  { eventType: 'trip.starting_soon', channel: 'in_app', isEnabled: true },
  { eventType: 'trip.starting_soon', channel: 'email', isEnabled: true },
  { eventType: 'reservation.reminder', channel: 'in_app', isEnabled: true },
  { eventType: 'reservation.reminder', channel: 'email', isEnabled: true },
  { eventType: 'expense.added', channel: 'in_app', isEnabled: true },
  { eventType: 'expense.added', channel: 'email', isEnabled: false },
  { eventType: 'expense.settled', channel: 'in_app', isEnabled: true },
  { eventType: 'list.assigned', channel: 'in_app', isEnabled: true },
  { eventType: 'collab.message', channel: 'in_app', isEnabled: true },
  { eventType: 'collab.message', channel: 'push', isEnabled: false },
  { eventType: 'organization.invited', channel: 'in_app', isEnabled: true },
  { eventType: 'organization.invited', channel: 'email', isEnabled: true },
]
