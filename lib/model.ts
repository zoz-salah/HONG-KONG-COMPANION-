import { z } from "zod";
import { DateTime } from "luxon";
import { flightTime } from "./clock";
export { flightTime, countdown } from "./clock";

const field = z.string().trim().max(300);
const required = field.min(1);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => DateTime.fromISO(v).isValid);
const time = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .refine((v) => DateTime.fromISO(v, { zone: "UTC" }).isValid);
const zone = z.enum(["Africa/Cairo", "Asia/Hong_Kong"]);
const amount = z.coerce.number().finite().positive().max(10000000);
const confirmation = {
  confirmed: z.boolean().default(false),
  confirmedAt: z.string().nullable().optional(),
};
export const models = {
  place: z.object({
    ar: required,
    en: required,
    zh: field,
    address: required,
    notes: field,
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    ...confirmation,
  }),
  home: z.object({
    en: required,
    zh: required,
    address: required,
    addressZh: required,
    ...confirmation,
  }),
  program: z
    .object({
      start: date,
      end: date,
      admission: z.enum(["unknown", "pending", "accepted", "declined"]),
      admissionConfirmed: z.boolean().default(false),
      ...confirmation,
    })
    .refine((v) => v.end >= v.start),
  event: z.object({
    title: required,
    date,
    category: z.enum(["class", "deadline", "personal", "program"]),
    notes: field,
    ...confirmation,
  }),
  checklist: z
    .object({
      ar: field,
      en: field,
      group: z.enum(["before", "arrival"]),
      done: z.boolean(),
    })
    .refine((v) => v.ar || v.en),
  flight: z
    .object({
      direction: z.enum(["outbound", "return"]),
      airline: required,
      number: required,
      from: required,
      to: required,
      depart: time,
      arrive: time,
      departZone: zone,
      arriveZone: zone,
      reference: field,
      ...confirmation,
    })
    .refine(
      (v) =>
        flightTime(v.arrive, v.arriveZone) > flightTime(v.depart, v.departZone),
    ),
  expense: z.object({
    amount,
    category: z.enum(["food", "transport", "stay", "shopping", "other"]),
    note: field,
    date,
    receipt: z
      .string()
      .regex(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/)
      .max(900000)
      .optional(),
  }),
  rate: z.object({ rate: amount, date }),
  phrase: z.object({ key: required }),
  station: z.object({ key: required }),
  resource: z.object({ key: required, date }),
  reminder: z.object({ title: required, at: time, zone }),
  chat: z.object({ question: field, answer: z.string().max(12000) }),
};
export type Kind = keyof typeof models;
export { calendar } from "./calendar";
