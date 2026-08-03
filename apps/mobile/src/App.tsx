import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Linking,
  LogBox,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  PlannedClient,
  type Invitation,
  type Member,
} from "@planned/api-client";
import type {
  BillingPlanResponse,
  DocumentMeta,
  ExpenseDto,
  NotificationRow,
  ReservationDto,
  TripDto,
  TripPlan,
} from "@planned/shared";
import { formatMoney, summarizeByCurrency, type CurrencySummary } from "@planned/shared";
import { createMobileAuthClient } from "./auth/client";
import {
  createSecureTokenStorage,
  SESSION_TOKEN_KEY,
  type SecureTokenStorage,
} from "./auth/storage";
import {
  authStateFromSession,
  signedOutState,
  type AuthState,
} from "./auth/state";
import { useTripSync } from "./collab/useTripSync";
import { projectPlace } from "./trip-map";
import "./global.css";

if (__DEV__) LogBox.ignoreAllLogs();

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://planned.travel";
type AuthClient = ReturnType<typeof createMobileAuthClient>;
type User = { id: string; name?: string | null; email?: string | null };

export default function App() {
  const storage = useMemo(() => createSecureTokenStorage(), []);
  const auth = useMemo(
    () => createMobileAuthClient({ baseURL: API_URL, storage }),
    [storage],
  );
  const [state, setState] = useState<AuthState>({ status: "loading" });
  useEffect(() => {
    auth
      .getSession()
      .then((result: { data?: { user: User } | null }) => {
        const data = result.data as { user: User } | null | undefined;
        setState(authStateFromSession(data ? { user: data.user } : null));
      })
      .catch(() =>
        setState(signedOutState("We couldn’t restore your session.")),
      );
  }, [auth]);
  if (state.status === "loading") return <LoadingScreen />;
  if (state.status === "signed-out")
    return (
      <SignInScreen
        auth={auth}
        storage={storage}
        error={state.error}
        onSignedIn={(user) => setState(authStateFromSession(user && { user }))}
      />
    );
  return (
    <HomeScreen
      auth={auth}
      user={state.user}
      storage={storage}
      onSignedOut={() => setState(signedOutState())}
    />
  );
}

function LoadingScreen() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator color="#2572e7" />
    </SafeAreaView>
  );
}

function SignInScreen({
  auth,
  storage,
  error,
  onSignedIn,
}: {
  auth: AuthClient;
  storage: SecureTokenStorage;
  error?: string;
  onSignedIn: (user: User | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(error);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setMessage(undefined);
    const result = await auth.signIn
      .email({ email, password })
      .catch(() => ({ error: { message: "Unable to sign in." } }));
    setBusy(false);
    if (result.error)
      return setMessage(result.error.message ?? "Unable to sign in.");
    // Better Auth clients can expose the signed-in user as either
    // `data.user` or `data` depending on the client/plugin adapter.
    const payload = result.data as unknown;
    const candidate =
      payload && typeof payload === "object" && "user" in payload
        ? (payload as { user?: unknown }).user
        : payload;
    const signedInUser = candidate as User | null | undefined;
    const token =
      payload && typeof payload === "object" && "token" in payload
        ? (payload as { token?: unknown }).token
        : undefined;
    if (typeof token === "string" && !storage.getItem(SESSION_TOKEN_KEY))
      await storage.setItem(SESSION_TOKEN_KEY, token);
    if (!signedInUser?.id)
      return setMessage("Unable to establish a mobile session.");
    onSignedIn(
      signedInUser?.id
        ? {
            id: signedInUser.id,
            name: signedInUser.name,
            email: signedInUser.email,
          }
        : null,
    );
  }
  return (
    <SafeAreaView className="flex-1 justify-center bg-white px-6">
      <Text className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">
        planned.travel
      </Text>
      <Text className="mb-2 text-4xl font-bold text-ink">
        Plan the trip together.
      </Text>
      <Text className="mb-8 text-base leading-6 text-muted-foreground">
        Sign in to keep your itinerary with you wherever you go.
      </Text>
      <TextInput
        testID="sign-in-email"
        accessibilityLabel="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        className="mb-3 rounded-xl border border-border px-4 py-3 text-base text-ink"
      />
      <TextInput
        testID="sign-in-password"
        accessibilityLabel="Password"
        autoComplete="off"
        textContentType="password"
        secureTextEntry
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        className="mb-3 rounded-xl border border-border px-4 py-3 text-base text-ink"
      />
      {message ? (
        <Text accessibilityRole="alert" className="mb-3 text-sm text-red-600">
          {message}
        </Text>
      ) : null}
      <PrimaryButton
        testID="sign-in-submit"
        accessibilityLabel="Sign in"
        disabled={busy}
        onPress={submit}
      >
        {busy ? "Signing in…" : "Sign in"}
      </PrimaryButton>
    </SafeAreaView>
  );
}

function HomeScreen({
  auth,
  user,
  storage,
  onSignedOut,
}: {
  auth: AuthClient;
  user: User;
  storage: SecureTokenStorage;
  onSignedOut: () => void;
}) {
  const rest = useMemo(
    () =>
      new PlannedClient({
        baseUrl: API_URL,
        getToken: () => storage.getItem(SESSION_TOKEN_KEY),
        onUnauthorized: async () => {
          await storage.deleteItem(SESSION_TOKEN_KEY);
          onSignedOut();
        },
      }),
    [storage],
  );
  const getToken = useCallback(() => storage.getItem(SESSION_TOKEN_KEY), [storage]);
  const [trips, setTrips] = useState<TripDto[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const load = useCallback(
    () =>
      rest
        .trips()
        .list()
        .then(setTrips)
        .catch(() => setError("Could not load your trips.")),
    [rest],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function createTrip() {
    if (!title.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const trip = {
        ...(await rest.trips().create({ title: title.trim() })),
        role: "owner" as const,
      };
      setTrips((old) => [trip, ...old]);
      setTitle("");
      setSelected(trip.id);
    } catch {
      setError("Could not create that trip.");
    } finally {
      setBusy(false);
    }
  }
  function signOut() {
    onSignedOut();
    void storage.deleteItem(SESSION_TOKEN_KEY);
    void auth.signOut().catch(() => undefined);
  }
  if (selected) {
    const trip = trips.find((item) => item.id === selected);
    if (trip)
      return (
        <TripWorkspace
          rest={rest}
          getToken={getToken}
          trip={trip}
          user={user}
          onBack={() => {
            setSelected(null);
            void load();
          }}
        />
      );
  }
  async function acceptInvite() {
    if (!inviteToken.trim()) return;
    try {
      const result = await rest.trips().acceptInvitation(inviteToken.trim());
      setInviteToken("");
      setSelected(result.tripId);
      void load();
    } catch {
      setError("That invitation is no longer available.");
    }
  }
  const latestTrip = trips[0];
  return (
    <SafeAreaView className="flex-1 bg-muted">
      <ScrollView contentContainerClassName="px-5 pb-40 pt-8">
        <Text className="text-sm font-semibold uppercase tracking-widest text-primary">
          Your trips
        </Text>
        <Text className="mt-2 text-3xl font-bold text-ink">
          Welcome{user.name ? `, ${user.name}` : " back"}.
        </Text>
        <Pressable
          testID="sign-out"
          accessibilityLabel="sign-out"
          accessibilityRole="button"
          onPress={signOut}
          className="mt-4 self-start rounded-xl border border-border bg-white px-4 py-2"
        >
          <Text className="font-semibold text-ink">Sign out</Text>
        </Pressable>
        <View className="mt-6 flex-row gap-2">
          <TextInput
            accessibilityLabel="New trip title"
            returnKeyType="go"
            onSubmitEditing={() => void createTrip()}
            placeholder="Name a new trip"
            value={title}
            onChangeText={setTitle}
            className="min-w-0 flex-1 rounded-xl border border-border bg-white px-4 py-3 text-base text-ink"
          />
          <PrimaryButton
            testID="create-trip-submit"
            disabled={busy || !title.trim()}
            onPress={createTrip}
          >
            {busy ? "…" : "Create"}
          </PrimaryButton>
        </View>
        <View className="mt-3 flex-row gap-2">
          <TextInput
            accessibilityLabel="Invitation token"
            placeholder="Paste an invite token"
            value={inviteToken}
            onChangeText={setInviteToken}
            className="min-w-0 flex-1 rounded-xl border border-border bg-white px-4 py-3 text-base text-ink"
          />
          <PrimaryButton disabled={!inviteToken.trim()} onPress={acceptInvite}>
            Join
          </PrimaryButton>
        </View>
        {error ? (
          <Text role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </Text>
        ) : null}
        <View className="mt-6 gap-3">
          {latestTrip ? (
            <Pressable
              testID="open-latest-trip"
              accessibilityLabel="Open latest trip"
              accessibilityRole="button"
              onPress={() => setSelected(latestTrip.id)}
              className="rounded-xl border border-primary bg-white px-4 py-3"
            >
              <Text className="text-center font-semibold text-primary">
                Open latest trip
              </Text>
            </Pressable>
          ) : null}
          {trips.length === 0 ? (
            <Text className="rounded-2xl border border-border bg-white p-5 text-muted-foreground">
              No trips yet. Create one to start planning.
            </Text>
          ) : (
            trips.map((trip) => (
              <Pressable
                testID={`trip-${trip.title.replace(/\s+/g, "-")}`}
                accessibilityRole="button"
                key={trip.id}
                onPress={() => setSelected(trip.id)}
                className="rounded-2xl border border-border bg-white p-5 active:opacity-70"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-xl font-bold text-ink">
                    {trip.title}
                  </Text>
                  <RoleBadge role={trip.role} />
                </View>
                <Text className="mt-2 text-sm text-muted-foreground">
                  {trip.startAt
                    ? new Date(trip.startAt).toLocaleDateString()
                    : "Dates to be decided"}
                </Text>
                <Text className="mt-4 font-semibold text-primary">
                  Open trip →
                </Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TripWorkspace({
  rest,
  getToken,
  trip,
  user,
  onBack,
}: {
  rest: PlannedClient;
  getToken: () => string | null;
  trip: TripDto;
  user: User;
  onBack: () => void;
}) {
  const [plan, setPlan] = useState<TripPlan>();
  const [error, setError] = useState<string>();
  const [note, setNote] = useState("");
  const [place, setPlace] = useState("");
  const [placeLat, setPlaceLat] = useState("");
  const [placeLng, setPlaceLng] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>();
  const [membersOpen, setMembersOpen] = useState(false);
  const [dayIndex, setDayIndex] = useState(0);
  const [section, setSection] = useState<"plan" | "reservations" | "costs" | "documents" | "notifications" | "billing">("plan");
  const load = useCallback(
    () =>
      rest
        .trips()
        .get(trip.id)
        .then(setPlan)
        .catch(() => setError("Could not load this trip.")),
    [rest, trip.id],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const { connected, presence } = useTripSync({
    baseUrl: API_URL,
    tripId: trip.id,
    getToken,
    onChange: () => void load(),
  });
  async function addNote() {
    if (!note.trim()) return;
    await rest
      .trips()
      .addItem(trip.id, { dayId: plan?.days[dayIndex]?.id, note: note.trim() });
    setNote("");
    void load();
  }
  async function addPlace() {
    if (!place.trim()) return;
    const lat = Number.parseFloat(placeLat);
    const lng = Number.parseFloat(placeLng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      setError("Enter a valid latitude (-90 to 90) and longitude (-180 to 180).");
      return;
    }
    await rest
      .trips()
      .addPlace(trip.id, { name: place.trim(), lat, lng });
    setPlace("");
    setPlaceLat("");
    setPlaceLng("");
    void load();
  }
  async function addDay() {
    await rest.trips().addDay(trip.id);
    void load();
  }
  if (!plan) return <LoadingScreen />;
  const day = plan.days[dayIndex] ?? plan.days[0];
  const items = plan.items.filter((item) => item.dayId === day?.id);
  const canEdit = trip.role !== "viewer";
  return (
    <SafeAreaView className="flex-1 bg-muted">
      <View className="border-b border-border bg-white px-5 pb-4 pt-3">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={onBack}>
            <Text className="font-semibold text-primary">‹ Trips</Text>
          </Pressable>
          <Pressable onPress={() => setMembersOpen(true)}>
            <Text className="font-semibold text-primary">People</Text>
          </Pressable>
        </View>
        <Text className="mt-3 text-3xl font-bold text-ink">{trip.title}</Text>
        <View className="mt-2 flex-row items-center gap-2">
          <View
            className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300"}`}
          />
          <Text
            testID="trip-connection-status"
            className="text-xs text-muted-foreground"
          >
            {connected ? "Live" : "Reconnecting…"}
          </Text>
          <Text testID="trip-presence" className="text-xs text-muted-foreground">
            {presence.length} online
          </Text>
          <Text testID="trip-role" className="text-xs text-muted-foreground">
            · {trip.role}
          </Text>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-2 border-b border-border bg-white px-5 py-3">
        {(["plan", "reservations", "costs", "documents", "notifications", "billing"] as const).map((item) => (
          <Pressable key={item} onPress={() => setSection(item)} className={`rounded-full px-3 py-2 ${section === item ? "bg-primary" : "bg-muted"}`}>
            <Text className={`text-xs font-semibold capitalize ${section === item ? "text-white" : "text-ink"}`}>{item}</Text>
          </Pressable>
        ))}
      </View>
      {section === "plan" ? <>
      <MapSurface
        places={plan.places}
        selectedPlaceId={selectedPlaceId}
        onSelectPlace={setSelectedPlaceId}
      />
      <View className="absolute inset-x-0 bottom-0 max-h-[62%] rounded-t-3xl border-t border-border bg-white px-5 pb-5 pt-3">
        <View
          className="mb-3 self-center rounded-full bg-slate-200"
          style={{ width: 42, height: 5 }}
        />
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-ink">Itinerary</Text>
          {canEdit ? (
            <Pressable onPress={addDay}>
              <Text className="font-semibold text-primary">+ Day</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3"
        >
          <View className="flex-row gap-2">
            {plan.days.map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => setDayIndex(index)}
                className={`rounded-full px-4 py-2 ${index === dayIndex ? "bg-primary" : "bg-muted"}`}
              >
                <Text
                  className={
                    index === dayIndex
                      ? "font-semibold text-white"
                      : "font-semibold text-muted-foreground"
                  }
                >
                  Day {index + 1}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <ScrollView className="mt-3" contentContainerClassName="pb-4">
          {items.length === 0 ? (
            <Text className="py-4 text-muted-foreground">
              Nothing planned for this day yet.
            </Text>
          ) : (
            items.map((item) => (
              <View
                key={item.id}
                className="mb-2 rounded-xl border border-border p-3"
              >
                <Text className="font-medium text-ink">
                  {item.placeId
                    ? (plan.places.find((p) => p.id === item.placeId)?.name ??
                      "Place")
                    : item.note}
                </Text>
              </View>
            ))
          )}
          {canEdit ? (
            <View className="mt-2 flex-row gap-2">
              <TextInput
                accessibilityLabel="Itinerary note"
                returnKeyType="go"
                onSubmitEditing={() => void addNote()}
                placeholder="Add a note"
                value={note}
                onChangeText={setNote}
                className="min-w-0 flex-1 rounded-xl border border-border bg-muted px-3 py-2 text-ink"
              />
              <PrimaryButton onPress={addNote}>Add</PrimaryButton>
            </View>
          ) : (
          <Text testID="view-only-access" className="mt-2 text-sm text-muted-foreground">
            View-only access
          </Text>
          )}
          {canEdit ? (
            <View className="mt-2 flex-row gap-2">
              <TextInput
                accessibilityLabel="Place name"
                returnKeyType="go"
                onSubmitEditing={() => void addPlace()}
                placeholder="Add a place"
                value={place}
                onChangeText={setPlace}
                className="min-w-0 flex-1 rounded-xl border border-border bg-muted px-3 py-2 text-ink"
              />
              <TextInput
                accessibilityLabel="Place latitude"
                keyboardType="numbers-and-punctuation"
                placeholder="Lat"
                value={placeLat}
                onChangeText={setPlaceLat}
                className="w-20 rounded-xl border border-border bg-muted px-3 py-2 text-ink"
              />
              <TextInput
                accessibilityLabel="Place longitude"
                keyboardType="numbers-and-punctuation"
                placeholder="Lng"
                value={placeLng}
                onChangeText={setPlaceLng}
                className="w-20 rounded-xl border border-border bg-muted px-3 py-2 text-ink"
              />
              <PrimaryButton onPress={addPlace}>Place</PrimaryButton>
            </View>
          ) : null}
        </ScrollView>
      </View>
      </> : <ManagementPanel rest={rest} trip={trip} section={section} canEdit={canEdit} getToken={getToken} />}
      <Modal
        visible={membersOpen}
        animationType="slide"
        onRequestClose={() => setMembersOpen(false)}
      >
        <MembersSheet
          rest={rest}
          trip={trip}
          user={user}
          onClose={() => setMembersOpen(false)}
        />
      </Modal>
      {error ? (
        <Text className="absolute left-5 right-5 top-28 rounded-xl bg-red-50 p-3 text-red-700">
          {error}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}

function MapSurface({
  places,
  selectedPlaceId,
  onSelectPlace,
}: {
  places: TripPlan["places"];
  selectedPlaceId?: string;
  onSelectPlace: (placeId: string) => void;
}) {
  const selected = places.find((place) => place.id === selectedPlaceId);
  return (
    <View
      accessibilityLabel="Trip map"
      accessibilityRole="adjustable"
      className="flex-1 bg-[#dbe8df]"
    >
      <View
        className="absolute inset-0 opacity-40"
        style={{ backgroundColor: "#b8d4c2" }}
      />
      {places.map((place, index) => {
        const position = projectPlace(place);
        return (
          <Pressable
          key={place.id}
          accessibilityLabel={`Show ${place.name} on map`}
          accessibilityRole="button"
          onPress={() => onSelectPlace(place.id)}
          className="absolute items-center"
          style={{ left: position.left, top: position.top }}
        >
          <View className={`h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow ${selectedPlaceId === place.id ? "bg-ink" : "bg-primary"}`}>
            <Text className="font-bold text-white">{index + 1}</Text>
          </View>
          </Pressable>
        );
      })}
      {selected ? (
        <Pressable
          accessibilityLabel={`Selected place ${selected.name}`}
          onPress={() => onSelectPlace(selected.id)}
          className="absolute bottom-5 left-5 right-5 rounded-2xl border border-border bg-white p-4 shadow"
        >
          <Text className="font-semibold text-ink">{selected.name}</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
          </Text>
        </Pressable>
      ) : null}
      <Text className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Map view
      </Text>
    </View>
  );
}

type ManagementSection = "reservations" | "costs" | "documents" | "notifications" | "billing";

function ManagementPanel({
  rest,
  trip,
  section,
  canEdit,
  getToken,
}: {
  rest: PlannedClient;
  trip: TripDto;
  section: ManagementSection;
  canEdit: boolean;
  getToken: () => string | null | Promise<string | null>;
}) {
  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDto[]>([]);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [documentReservations, setDocumentReservations] = useState<ReservationDto[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [billing, setBilling] = useState<BillingPlanResponse>();
  const [summaries, setSummaries] = useState<CurrencySummary[]>([]);
  const [notificationCursor, setNotificationCursor] = useState<number>();
  const [hasMoreNotifications, setHasMoreNotifications] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [title, setTitle] = useState("");
  const [reservationType, setReservationType] = useState<"flight" | "hotel" | "restaurant" | "rental" | "transport" | "other">("other");
  const [reservationStarts, setReservationStarts] = useState("");
  const [reservationEnds, setReservationEnds] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");

  const load = useCallback(async (beforeNotification?: number) => {
    setError(undefined);
    try {
      if (section === "reservations") setReservations(await rest.reservations(trip.id).list());
      if (section === "costs") {
        const [loadedExpenses, loadedMembers] = await Promise.all([rest.expenses(trip.id).list(), rest.trips().members(trip.id)]);
        setExpenses(loadedExpenses);
        setSummaries(summarizeByCurrency(loadedMembers.map((member) => ({ userId: member.userId })), loadedExpenses));
      }
      if (section === "documents") {
        const [loadedDocuments, loadedReservations] = await Promise.all([rest.documents(trip.id).list(), rest.reservations(trip.id).list()]);
        setDocuments(loadedDocuments);
        setDocumentReservations(loadedReservations);
      }
      if (section === "notifications") {
        const page = await rest.notifications().list(20, beforeNotification);
        setNotifications((old) => beforeNotification ? [...old, ...page.items] : page.items);
        setNotificationCursor(page.nextCursor ?? undefined);
        setHasMoreNotifications(page.nextCursor != null);
      }
      if (section === "billing") setBilling(await rest.billing().plan());
    } catch {
      setError("Could not load this section. Please try again.");
    }
  }, [rest, section, trip.id]);
  useEffect(() => { void load(); }, [load]);

  async function createReservation() {
    if (!title.trim() || !canEdit) return;
    const startsAt = reservationStarts ? Date.parse(reservationStarts) : undefined;
    const endsAt = reservationEnds ? Date.parse(reservationEnds) : undefined;
    if ((startsAt !== undefined && Number.isNaN(startsAt)) || (endsAt !== undefined && Number.isNaN(endsAt))) {
      setError("Use a valid date, for example 2026-08-03.");
      return;
    }
    setBusy(true);
    try { await rest.reservations(trip.id).create({ title: title.trim(), type: reservationType, status: "planned", startsAt, endsAt }); setTitle(""); setReservationStarts(""); setReservationEnds(""); await load(); }
    catch { setError("Could not add the reservation."); }
    finally { setBusy(false); }
  }
  async function createExpense() {
    const cents = Math.round(Number.parseFloat(amount.replace(",", ".")) * 100);
    const normalizedCurrency = currency.trim().toUpperCase();
    if (!canEdit) return;
    if (!Number.isFinite(cents) || cents < 0 || !/^[A-Z]{3}$/.test(normalizedCurrency)) {
      setError("Enter an amount and a three-letter currency.");
      return;
    }
    setBusy(true);
    try { await rest.expenses(trip.id).create({ amountCents: cents, currency: normalizedCurrency }); setAmount(""); await load(); }
    catch { setError("Could not add the expense."); }
    finally { setBusy(false); }
  }
  async function confirmReservation(item: ReservationDto) {
    if (!canEdit) return;
    setBusy(true);
    try { await rest.reservations(trip.id).update(item.id, { status: item.status === "confirmed" ? "planned" : "confirmed" }); await load(); }
    catch { setError("Could not update the reservation."); }
    finally { setBusy(false); }
  }
  async function removeReservation(id: string) {
    if (!canEdit) return;
    setBusy(true);
    try { await rest.reservations(trip.id).remove(id); await load(); }
    catch { setError("Could not remove the reservation."); }
    finally { setBusy(false); }
  }
  async function removeExpense(id: string) {
    if (!canEdit) return;
    setBusy(true);
    try { await rest.expenses(trip.id).remove(id); await load(); }
    catch { setError("Could not remove the expense."); }
    finally { setBusy(false); }
  }
  async function openBillingAction(action: "month" | "year" | "portal") {
    setBusy(true);
    try {
      const result = action === "portal" ? await rest.billing().portal() : await rest.billing().checkout(action);
      await Linking.openURL(result.url);
    } catch { setError("Billing is unavailable right now."); }
    finally { setBusy(false); }
  }
  async function exportPdf() {
    setBusy(true);
    try { await rest.billing().exportPdf(trip.id); Alert.alert("Export ready", "Your plan allows PDF export. Open the web app to download it."); }
    catch (cause) { setError(cause instanceof Error && cause.message.includes("402") ? "PDF export requires Pro." : "PDF export is unavailable right now."); }
    finally { setBusy(false); }
  }
  async function uploadDocument() {
    if (!canEdit) return;
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    const file = result.assets[0];
    setBusy(true);
    try { await rest.documents(trip.id).upload({ uri: file.uri, name: file.name, type: file.mimeType ?? "application/octet-stream" }); await load(); }
    catch { setError("Could not upload that document. Check its type and size."); }
    finally { setBusy(false); }
  }
  async function removeDocument(id: string) {
    if (!canEdit) return;
    setBusy(true);
    try { await rest.documents(trip.id).remove(id); await load(); }
    catch { setError("Could not remove that document."); }
    finally { setBusy(false); }
  }
  async function downloadDocument(item: DocumentMeta) {
    setBusy(true);
    try {
      const token = await getToken();
      const safeName = item.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const target = `${FileSystem.cacheDirectory}${safeName}`;
      const result = await FileSystem.downloadAsync(rest.documents(trip.id).downloadUrl(item.id), target, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { mimeType: item.mimeType, dialogTitle: item.name });
      else setError("Sharing documents is not available on this device.");
    } catch { setError("Could not download that document."); }
    finally { setBusy(false); }
  }
  async function toggleDocumentLink(item: DocumentMeta) {
    if (!canEdit) return;
    const reservationId = item.reservationId ? null : documentReservations[0]?.id;
    if (!item.reservationId && !reservationId) { setError("Create a reservation before linking a document."); return; }
    setBusy(true);
    try { await rest.documents(trip.id).link(item.id, reservationId ?? null); await load(); }
    catch { setError("Could not update the document link."); }
    finally { setBusy(false); }
  }

  return (
    <ScrollView className="flex-1 bg-muted" contentContainerClassName="px-5 pb-12 pt-5">
      <Text className="mb-4 text-2xl font-bold capitalize text-ink">{section}</Text>
      {error ? <Text accessibilityRole="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-red-700">{error}</Text> : null}
      {section === "reservations" ? <>
        {canEdit ? <View className="mb-4 gap-2"><TextInput accessibilityLabel="Reservation title" placeholder="Reservation title" value={title} onChangeText={setTitle} className="rounded-xl border border-border bg-white px-3 py-3 text-ink" /><View className="flex-row flex-wrap gap-2">{(["flight", "hotel", "restaurant", "rental", "transport", "other"] as const).map((item) => <Pressable key={item} onPress={() => setReservationType(item)} className={`rounded-full px-3 py-2 ${reservationType === item ? "bg-primary" : "bg-muted"}`}><Text className={reservationType === item ? "text-white" : "text-ink"}>{item}</Text></Pressable>)}</View><View className="flex-row gap-2"><TextInput accessibilityLabel="Reservation start date" placeholder="Start date (YYYY-MM-DD)" value={reservationStarts} onChangeText={setReservationStarts} className="min-w-0 flex-1 rounded-xl border border-border bg-white px-3 py-3 text-ink" /><TextInput accessibilityLabel="Reservation end date" placeholder="End date" value={reservationEnds} onChangeText={setReservationEnds} className="min-w-0 flex-1 rounded-xl border border-border bg-white px-3 py-3 text-ink" /></View><PrimaryButton disabled={busy || !title.trim()} onPress={createReservation}>Add reservation</PrimaryButton></View> : <ReadOnlyNotice />}
        {reservations.length === 0 ? <EmptyState label="No reservations yet." /> : reservations.map((item) => <Row key={item.id} title={item.title ?? item.type} detail={`${item.status} · ${item.confirmationCode ?? "No confirmation code"}`} action={canEdit ? () => void confirmReservation(item) : undefined} actionLabel={item.status === "confirmed" ? "Mark planned" : "Confirm"} secondaryAction={canEdit ? () => void removeReservation(item.id) : undefined} secondaryActionLabel="Remove" />)}
      </> : null}
      {section === "costs" ? <>
        {canEdit ? <View className="mb-4 flex-row items-center gap-2"><TextInput accessibilityLabel="Expense amount" keyboardType="decimal-pad" placeholder="Amount" value={amount} onChangeText={setAmount} className="min-w-0 flex-1 rounded-xl border border-border bg-white px-3 py-3 text-ink" /><TextInput accessibilityLabel="Currency" autoCapitalize="characters" maxLength={3} returnKeyType="done" value={currency} onChangeText={setCurrency} onSubmitEditing={() => void createExpense()} className="w-20 rounded-xl border border-border bg-white px-3 py-3 text-ink" /><Button testID="add-expense" accessibilityLabel="Add expense" disabled={busy || !amount.trim()} title="Add" onPress={() => void createExpense()} /></View> : <ReadOnlyNotice />}
        {summaries.length === 0 ? <EmptyState label="No expenses yet." /> : <><Text className="mb-2 text-lg font-bold text-ink">Balances</Text>{summaries.map((summary) => <View key={summary.currency} className="mb-3 rounded-xl border border-border bg-white p-4"><Text className="font-bold text-ink">{summary.currency} · {formatMoney(summary.totalCents, summary.currency)}</Text>{summary.balances.map((balance) => <Text key={balance.userId} className="mt-1 text-sm text-muted-foreground">{balance.userId}: {formatMoney(balance.netCents, summary.currency)}</Text>)}{summary.settlements.map((settlement) => <Text key={`${settlement.fromUserId}-${settlement.toUserId}`} className="mt-2 text-sm text-primary">Settlement: {formatMoney(settlement.amountCents, summary.currency)}</Text>)}</View>)}<Text className="mb-2 text-lg font-bold text-ink">Expenses</Text>{expenses.map((item) => <Row key={item.id} title={`${(item.amountCents / 100).toFixed(2)} ${item.currency}`} detail={item.description ?? "Shared expense"} action={canEdit ? () => void removeExpense(item.id) : undefined} actionLabel="Remove" />)}</>}
      </> : null}
      {section === "documents" ? <>
        <Text className="mb-3 rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground">Files are limited to 50 MiB and protected by trip permissions.</Text>
        {canEdit ? <PrimaryButton disabled={busy} onPress={() => void uploadDocument()}>{busy ? "Uploading…" : "Choose document"}</PrimaryButton> : <ReadOnlyNotice />}
        {documents.length === 0 ? <EmptyState label="No documents yet." /> : documents.map((item) => <View key={item.id} className="mb-2 rounded-xl border border-border bg-white p-4"><Text className="font-semibold text-ink">{item.name}</Text><Text className="mt-1 text-sm text-muted-foreground">{Math.ceil(item.sizeBytes / 1024)} KB · {item.mimeType}{item.reservationId ? " · linked" : ""}</Text><View className="mt-3 flex-row flex-wrap gap-4"><Pressable disabled={busy} onPress={() => void downloadDocument(item)}><Text className="text-sm font-semibold text-primary">Download</Text></Pressable>{canEdit ? <><Pressable disabled={busy} onPress={() => void toggleDocumentLink(item)}><Text className="text-sm font-semibold text-primary">{item.reservationId ? "Unlink" : "Link reservation"}</Text></Pressable><Pressable disabled={busy} onPress={() => void removeDocument(item.id)}><Text className="text-sm font-semibold text-red-700">Remove</Text></Pressable></> : null}</View></View>)}
      </> : null}
      {section === "notifications" ? <>
        <PrimaryButton disabled={busy} onPress={async () => { setBusy(true); try { await rest.notifications().markAllRead(); await load(); } catch { setError("Could not update notifications."); } finally { setBusy(false); } }}>Mark all read</PrimaryButton>
        <View className="mt-4">{notifications.length === 0 ? <EmptyState label="You're all caught up." /> : notifications.map((item) => <Pressable key={item.id} onPress={() => void rest.notifications().markRead(item.id).then(() => load())} className={`mb-2 rounded-xl border border-border p-4 ${item.readAt ? "bg-white" : "bg-primary/10"}`}><Text className="font-semibold text-ink">{item.type.replaceAll("_", " ")}</Text><Text className="mt-1 text-sm text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</Text></Pressable>)}</View>{hasMoreNotifications ? <PrimaryButton disabled={busy} onPress={() => void load(notificationCursor)}>Load more notifications</PrimaryButton> : null}
      </> : null}
      {section === "billing" ? <>
        {billing ? <View className="rounded-2xl border border-border bg-white p-5"><Text className="text-xl font-bold text-ink">{billing.plan === "pro" ? "Pro plan" : "Free plan"}</Text><Text className="mt-2 text-sm text-muted-foreground">{billing.tripLimit == null ? "Unlimited trips" : `${billing.tripCount} of ${billing.tripLimit} trips used`}</Text><View className="mt-4 gap-2">{billing.plan === "pro" ? <PrimaryButton disabled={busy} onPress={() => void openBillingAction("portal")}>Manage billing</PrimaryButton> : <><PrimaryButton disabled={busy} onPress={() => void openBillingAction("month")}>Upgrade monthly</PrimaryButton><PrimaryButton disabled={busy} onPress={() => void openBillingAction("year")}>Upgrade yearly</PrimaryButton></>}<PrimaryButton disabled={busy} onPress={() => void exportPdf()}>Export trip PDF</PrimaryButton></View></View> : <LoadingScreen />}
      </> : null}
    </ScrollView>
  );
}

function Row({ title, detail, action, actionLabel, secondaryAction, secondaryActionLabel }: { title: string; detail: string; action?: () => void; actionLabel?: string; secondaryAction?: () => void; secondaryActionLabel?: string }) { return <View className="mb-2 rounded-xl border border-border bg-white p-4"><Text className="font-semibold text-ink">{title}</Text><Text className="mt-1 text-sm text-muted-foreground">{detail}</Text>{action ? <View className="mt-3 flex-row gap-4"><Pressable onPress={action}><Text className="text-sm font-semibold text-primary">{actionLabel}</Text></Pressable>{secondaryAction ? <Pressable onPress={secondaryAction}><Text className="text-sm font-semibold text-red-700">{secondaryActionLabel}</Text></Pressable> : null}</View> : null}</View>; }
function EmptyState({ label }: { label: string }) { return <Text className="rounded-xl border border-border bg-white p-5 text-muted-foreground">{label}</Text>; }
function ReadOnlyNotice() { return <Text className="mb-4 rounded-xl bg-white p-3 text-sm text-muted-foreground">View-only access</Text>; }

function MembersSheet({
  rest,
  trip,
  user,
  onClose,
}: {
  rest: PlannedClient;
  trip: TripDto;
  user: User;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const owner = trip.role === "owner";
  const load = useCallback(
    () =>
      Promise.all([
        rest.trips().members(trip.id),
        owner
          ? rest.trips().invitations(trip.id)
          : Promise.resolve([] as Invitation[]),
      ]).then(([m, i]) => {
        setMembers(m);
        setInvites(i);
      }),
    [rest, trip.id, owner],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function invite() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await rest
        .trips()
        .addMember(trip.id, { email: email.trim(), role: "editor" });
      setEmail("");
      void load();
    } finally {
      setBusy(false);
    }
  }
  async function link() {
    const result = await rest
      .trips()
      .createInvitation(trip.id, { role: "editor", maxUses: 5 });
    setInvites((old) => [result as Invitation, ...old]);
  }
  async function setRole(member: Member, role: "editor" | "viewer") {
    await rest.trips().updateMember(trip.id, member.userId, role);
    setMembers((old) =>
      old.map((item) =>
        item.userId === member.userId ? { ...item, role } : item,
      ),
    );
  }
  async function remove(member: Member) {
    await rest.trips().removeMember(trip.id, member.userId);
    setMembers((old) => old.filter((item) => item.userId !== member.userId));
  }
  return (
    <SafeAreaView className="flex-1 bg-muted px-5 pt-6">
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-ink">Collaborators</Text>
        <Pressable onPress={onClose}>
          <Text className="font-semibold text-primary">Done</Text>
        </Pressable>
      </View>
      <Text className="mt-1 text-sm text-muted-foreground">
        Changes sync live across every device.
      </Text>
      <ScrollView className="mt-5">
        {members.map((member) => (
          <View
            key={member.userId}
            className="mb-2 rounded-xl border border-border bg-white p-4"
          >
            <View className="flex-row items-center">
              <View className="flex-1">
                <Text className="font-semibold text-ink">
                  {member.name ?? member.email ?? member.userId.slice(0, 8)}
                  {member.userId === user.id ? " (you)" : ""}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {member.email ?? ""}
                </Text>
              </View>
              <RoleBadge role={member.role} />
            </View>
            {owner && member.role !== "owner" ? (
              <View className="mt-3 flex-row gap-2">
                <Pressable
                  onPress={() => void setRole(member, "editor")}
                  className={`rounded-lg px-3 py-2 ${member.role === "editor" ? "bg-primary" : "bg-muted"}`}
                >
                  <Text
                    className={
                      member.role === "editor" ? "text-white" : "text-ink"
                    }
                  >
                    Editor
                  </Text>
                </Pressable>
                  <Pressable
                    testID="role-viewer"
                    onPress={() => void setRole(member, "viewer")}
                  className={`rounded-lg px-3 py-2 ${member.role === "viewer" ? "bg-primary" : "bg-muted"}`}
                >
                  <Text
                    className={
                      member.role === "viewer" ? "text-white" : "text-ink"
                    }
                  >
                    Viewer
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void remove(member)}
                  className="ml-auto rounded-lg bg-red-50 px-3 py-2"
                >
                  <Text className="text-red-700">Remove</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
        {owner ? (
          <>
            <Text className="mb-2 mt-5 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Add a member
            </Text>
            <View className="flex-row gap-2">
              <TextInput
                testID="member-email"
                accessibilityLabel="Member email"
                returnKeyType="go"
                onSubmitEditing={() => void invite()}
                placeholder="traveler@example.com"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                className="min-w-0 flex-1 rounded-xl border border-border bg-white px-3 py-3 text-ink"
              />
              <PrimaryButton disabled={busy} onPress={invite}>
                Invite
              </PrimaryButton>
            </View>
            <Pressable
              onPress={link}
              className="mt-5 rounded-xl border border-primary bg-white p-4"
            >
              <Text className="font-semibold text-primary">
                Create share link
              </Text>
            </Pressable>
            {invites.map((item) => (
              <Text
                selectable
                key={item.id}
                className="mt-2 rounded-xl bg-white p-3 text-xs text-muted-foreground"
              >
                {item.url}
              </Text>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryButton({
  children,
  onPress,
  onPressIn,
  disabled,
  testID,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress: () => void;
  onPressIn?: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      className="items-center justify-center rounded-xl bg-primary px-4 py-3 active:bg-primary-hover disabled:opacity-50"
    >
      <Text className="font-semibold text-white">{children}</Text>
    </Pressable>
  );
}
function RoleBadge({ role }: { role: string }) {
  return (
    <Text className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold capitalize text-primary">
      {role}
    </Text>
  );
}
