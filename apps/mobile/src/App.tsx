import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Button,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  PlannedClient,
  type Invitation,
  type Member,
} from "@planned/api-client";
import type { TripDto, TripPlan } from "@planned/shared";
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
import "./global.css";

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
      }),
    [storage],
  );
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
          getToken={() => storage.getItem(SESSION_TOKEN_KEY)}
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
  return (
    <SafeAreaView className="flex-1 bg-muted">
      <ScrollView contentContainerClassName="px-5 pb-40 pt-8">
        <Text className="text-sm font-semibold uppercase tracking-widest text-primary">
          Your trips
        </Text>
        <Text className="mt-2 text-3xl font-bold text-ink">
          Welcome{user.name ? `, ${user.name}` : " back"}.
        </Text>
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
          {trips.length === 0 ? (
            <Text className="rounded-2xl border border-border bg-white p-5 text-muted-foreground">
              No trips yet. Create one to start planning.
            </Text>
          ) : (
            trips.map((trip) => (
              <Pressable
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
          <View
            className="mt-8 items-center rounded-xl border border-border bg-white px-4 py-3"
          >
            <Button testID="sign-out" title="Sign out" onPress={signOut} />
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
  const [membersOpen, setMembersOpen] = useState(false);
  const [dayIndex, setDayIndex] = useState(0);
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
    await rest
      .trips()
      .addPlace(trip.id, { name: place.trim(), lat: 0, lng: 0 });
    setPlace("");
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
          <Text className="text-xs text-muted-foreground">
            {connected ? "Live" : "Reconnecting…"} · {presence.length} online ·{" "}
            {trip.role}
          </Text>
        </View>
      </View>
      <MapSurface places={plan.places} />
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
            <Text className="mt-2 text-sm text-muted-foreground">
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
              <PrimaryButton onPress={addPlace}>Place</PrimaryButton>
            </View>
          ) : null}
        </ScrollView>
      </View>
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

function MapSurface({ places }: { places: TripPlan["places"] }) {
  return (
    <View accessibilityLabel="Trip map" className="flex-1 bg-[#dbe8df]">
      <View
        className="absolute inset-0 opacity-40"
        style={{ backgroundColor: "#b8d4c2" }}
      />
      {places.map((place, index) => (
        <View
          key={place.id}
          className="absolute items-center"
          style={{
            left: `${20 + ((index * 31) % 70)}%`,
            top: `${25 + ((index * 23) % 45)}%`,
          }}
        >
          <View className="h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary shadow">
            <Text className="font-bold text-white">{index + 1}</Text>
          </View>
          <Text className="mt-1 rounded bg-white/90 px-1 text-xs text-ink">
            {place.name}
          </Text>
        </View>
      ))}
      <Text className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Map view
      </Text>
    </View>
  );
}

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
  disabled,
  testID,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress: () => void;
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
