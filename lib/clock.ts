import { DateTime } from "luxon";
export function flightTime(timeValue: string, timezone: string) {
  return DateTime.fromISO(timeValue, { zone: timezone }).toMillis();
}
export function countdown(
  flights: {
    direction: string;
    depart: string;
    departZone: string;
    arrive: string;
    arriveZone: string;
    confirmed: boolean;
  }[],
  now: number,
) {
  const byDeparture = [...flights].sort(
    (a, b) =>
      flightTime(a.depart, a.departZone) - flightTime(b.depart, b.departZone),
  );
  const future = byDeparture.filter(
    (v) => flightTime(v.depart, v.departZone) > now,
  );
  const active =
    future.find((v) => v.direction === "outbound") ??
    future.find((v) => v.direction === "return");
  if (!active) return null;
  const remaining = flightTime(active.depart, active.departZone) - now;
  if (remaining <= 0) return null;
  return {
    hours: Math.floor(remaining / 3600000),
    direction: active.direction,
    confirmed: active.confirmed,
  };
}
