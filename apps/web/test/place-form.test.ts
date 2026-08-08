import { describe, expect, it, vi } from "vitest";
import { submitPlaceForm } from "../src/components/trips/submit-place-form";

const values = {
  tripId: "trip-1",
  dayId: "day-2",
  name: "Alfama",
  lat: "38.711",
  lng: "-9.13",
};

describe("place form submission", () => {
  it("submits the selected day and resets only after the mutation refresh completes", async () => {
    let completeMutation: (() => void) | undefined;
    const mutate = vi.fn(() => new Promise<void>((resolve) => {
      completeMutation = resolve;
    }));
    const reset = vi.fn();

    const pending = submitPlaceForm(values, mutate, reset);

    expect(mutate).toHaveBeenCalledWith({
      tripId: "trip-1",
      dayId: "day-2",
      name: "Alfama",
      lat: 38.711,
      lng: -9.13,
    });
    expect(reset).not.toHaveBeenCalled();

    completeMutation?.();
    await pending;

    expect(reset).toHaveBeenCalledOnce();
  });

  it("preserves every field when the mutation fails", async () => {
    const reset = vi.fn();

    await expect(submitPlaceForm(values, async () => {
      throw new Error("write failed");
    }, reset)).rejects.toThrow("write failed");

    expect(reset).not.toHaveBeenCalled();
  });

  it("omits dayId so the server can create or select the first day", async () => {
    const mutate = vi.fn(async () => undefined);

    await submitPlaceForm({ ...values, dayId: "" }, mutate, vi.fn());

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ dayId: undefined }));
  });
});
