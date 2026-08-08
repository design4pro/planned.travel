export interface PlaceFormValues {
  tripId: string;
  dayId: string;
  name: string;
  lat: string;
  lng: string;
}

interface PlaceMutationInput {
  tripId: string;
  dayId?: string;
  name: string;
  lat: number;
  lng: number;
}

export async function submitPlaceForm(
  values: PlaceFormValues,
  mutate: (input: PlaceMutationInput) => Promise<unknown>,
  reset: () => void,
) {
  await mutate({
    tripId: values.tripId,
    dayId: values.dayId || undefined,
    name: values.name,
    lat: Number(values.lat),
    lng: Number(values.lng),
  });
  reset();
}
