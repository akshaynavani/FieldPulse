import { useEffect, useState } from "react";
import * as Location from "expo-location";
import type { LatLng } from "@fieldpulse/contracts";

export async function currentPosition(): Promise<LatLng | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

export function useCurrentPosition(): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(null);
  useEffect(() => {
    currentPosition().then(setPos).catch(() => setPos(null));
  }, []);
  return pos;
}
