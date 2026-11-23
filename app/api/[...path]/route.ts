import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import sharp from "sharp";
import { db } from "../../../lib/db";
import {
  currentUser,
  endSession,
  hash,
  passwordHash,
  startSession,
  verifyPassword,
} from "../../../lib/auth";
import { calendar, flightTime, models, type Kind } from "../../../lib/model";
import {
  FeatureError,
  maxUpload,
  ocr,
  ocrStatus,
  parseFile,
  upload,
} from "../../../lib/documents";
import { answer, chunks, embed, type Source } from "../../../lib/grounding";
import {
  fx,
  getTrain,
  isStation,
  pushConfigured,
  translate,
  translationConfigured,
} from "../../../lib/integrations";
import checklists from "../../../data/checklists.json";
import knowledge from "../../../data/knowledge.json";

export const runtime = "nodejs";
const access = new Map<string, { count: number; until: number }>();
function limit(key: string, max: number) {
  const now = Date.now();
  if (access.size > 3000)
    for (const [id, entry] of access) if (entry.until < now) access.delete(id);
  const entry = access.get(key);
  if (!entry || entry.until < now) {
    access.set(key, { count: 1, until: now + 60000 });
    return;
  }
  if (++entry.count > max) throw new FeatureError("rateLimit");
}
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const error = (code: string, status = 400) => json({ error: code }, status);
const recordSelect = {
  id: true,
  kind: true,
  data: true,
  due: true,
  deliveredAt: true,
} as const;
const account = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(10).max(120),
});
const selection = z
  .object({
    events: z.array(z.string()).max(200),
    places: z.array(z.string()).max(200),
    program: z.array(z.string()).max(1).default([]),
  })
  .refine((v) => v.events.length + v.places.length + v.program.length > 0);
const subscription = z.object({
  endpoint: z.url().max(3000),
  keys: z.object({
    p256dh: z.string().regex(/^[\w-]{80,100}$/),
    auth: z.string().regex(/^[\w-]{20,30}$/),
  }),
});
const pushHosts = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  "notify.windows.com",
  "wns.windows.com",
];
function pushEndpoint(value: string) {
  const url = new URL(value);
  return (
    url.protocol === "https:" &&
    !url.port &&
    !url.username &&
    !url.password &&
    pushHosts.some(
      (host) => url.hostname === host || url.hostname.endsWith("." + host),
    )
  );
}
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handle(request, (await context.params).path);
}
export const POST = GET;
export const PATCH = GET;
export const DELETE = GET;
async function handle(req: NextRequest, path: string[]) {
  try {
    const [route, id, detail, extra] = path;
    const method = req.method;
    const origin = req.headers.get("origin");
    if (method !== "GET") {
      if (req.headers.get("sec-fetch-site") === "cross-site")
        return error("forbidden", 403);
      if (origin) {
        const requestOrigin = URL.canParse(origin) ? new URL(origin) : null;
        const matched = process.env.APP_ORIGIN
          ? origin === process.env.APP_ORIGIN
          : requestOrigin?.host === req.headers.get("host");
        if (!matched) return error("forbidden", 403);
      }
    }
    if (Number(req.headers.get("content-length") ?? 0) > maxUpload + 200000)
      return error("fileSize", 413);
    if (route === "share") {
      if (method !== "GET" || !id || detail || extra)
        return error("notFound", 404);
      const share = await db.share.findUnique({ where: { token: hash(id) } });
      if (!share) return error("notFound", 404);
      const chosen = selection.parse(share.selection);
      const rows = await db.record.findMany({
        where: {
          userId: share.userId,
          OR: [
            { kind: "event", id: { in: chosen.events } },
            { kind: "place", id: { in: chosen.places } },
            { kind: "program", id: { in: chosen.program } },
          ],
        },
        select: { kind: true, data: true },
      });
      return json(
        rows.map((row) => {
          if (row.kind === "event") {
            const { title, date, category, notes, confirmed } =
              models.event.parse(row.data);
            return {
              kind: row.kind,
              data: { title, date, category, notes, confirmed },
            };
          }
          if (row.kind === "program") {
            const { start, end, confirmed } = models.program.parse(row.data);
            return { kind: row.kind, data: { start, end, confirmed } };
          }
          const { ar, en, zh, address, notes, lat, lng, confirmed } =
            models.place.parse(row.data);
          return {
            kind: row.kind,
            data: { ar, en, zh, address, notes, lat, lng, confirmed },
          };
        }),
      );
    }
    if (["login", "register"].includes(route) && method === "POST" && !id) {
      limit("auth:" + (req.headers.get("x-real-ip") ?? "local"), 12);
      const { email, password } = account.parse(await req.json());
      let user = await db.user.findUnique({ where: { email } });
      if (route === "register") {
        if (user) return error("accountExists", 409);
        try {
          user = await db.user.create({
            data: {
              email,
              password: passwordHash(password),
              records: {
                create: [
                  {
                    kind: "program",
                    data: {
                      start: "2027-06-30",
                      end: "2027-07-31",
                      admission: "unknown",
                      admissionConfirmed: false,
                      confirmed: false,
                    },
                  },
                  ...checklists.map((data) => ({
                    kind: "checklist",
                    data: { ...data, done: false },
                  })),
                ],
              },
            },
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002"
          )
            return error("accountExists", 409);
          throw e;
        }
      } else if (!user || !verifyPassword(password, user.password))
        return error("invalidLogin", 401);
      await endSession();
      await startSession(user.id);
      return json({ id: user.id, email: user.email });
    }
    if (route === "logout" && method === "POST" && !id) {
      await endSession();
      return json({ ok: true });
    }
    if (route === "config" && method === "GET" && !id) {
      return json({
        ocr: await ocrStatus(),
        translation: translationConfigured(),
        push: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null,
      });
    }
    const user = await currentUser();
    if (route === "me" && method === "GET" && !id) return json(user);
    if (!user) return error("signIn", 401);
    if (route === "state" && method === "GET" && !id)
      return json(
        await db.record.findMany({
          where: { userId: user.id },
          select: recordSelect,
          orderBy: { id: "asc" },
        }),
      );
    if (route === "records" && id && Object.hasOwn(models, id)) {
      const kind = id as Kind;
      if ((!detail && method === "POST") || (detail && method === "PATCH")) {
        const data = models[kind].parse(await req.json()) as Record<
          string,
          Prisma.InputJsonValue | null
        >;
        if (kind === "station" && !isStation(String(data.key)))
          return error("unsupportedStation");
        const due =
          kind === "reminder"
            ? new Date(flightTime(String(data.at), String(data.zone)))
            : null;
        if (due && due.getTime() <= Date.now()) return error("pastReminder");
        const row = await db.$transaction(async (tx) => {
          const where = { userId: user.id, kind };
          const existing = detail
            ? await tx.record.findFirst({ where: { ...where, id: detail } })
            : null;
          if (detail && !existing) return null;
          if (data.confirmed) {
            const old = existing?.data as Record<string, unknown> | undefined;
            const changed = Object.keys(data).some(
              (key) =>
                ![
                  "confirmed",
                  "confirmedAt",
                  "admission",
                  "admissionConfirmed",
                ].includes(key) && data[key] !== old?.[key],
            );
            data.confirmedAt =
              !changed && old?.confirmed && typeof old.confirmedAt === "string"
                ? old.confirmedAt
                : new Date().toISOString();
          } else if ("confirmed" in data) data.confirmedAt = null;
          if (kind === "expense" && existing && data.receipt === undefined) {
            const old = existing.data as Record<string, Prisma.InputJsonValue>;
            if (old.receipt) data.receipt = old.receipt;
          }
          const values = {
            data: data as Prisma.InputJsonObject,
            due,
            deliveredAt: null,
            claimedUntil: null,
          };
          if (existing)
            return tx.record.update({
              where: { id: existing.id },
              data: values,
              select: recordSelect,
            });
          const keyed =
            kind === "phrase" || kind === "resource" || kind === "station";
          if (keyed || ["home", "program", "rate"].includes(kind)) {
            const duplicate = (await tx.record.findMany({ where })).find(
              (r) => !keyed || (r.data as { key: string }).key === data.key,
            );
            if (duplicate)
              return tx.record.update({
                where: { id: duplicate.id },
                data: values,
                select: recordSelect,
              });
          }
          return tx.record.create({
            data: { ...values, ...where },
            select: recordSelect,
          });
        });
        return row ? json(row) : error("notFound", 404);
      }
      if (detail && method === "DELETE") {
        const result = await db.record.deleteMany({
          where: { id: detail, userId: user.id, kind },
        });
        return result.count ? json({ ok: true }) : error("notFound", 404);
      }
    }
    if (route === "documents") {
      const owner = { userId: user.id };
      if (!id && method === "GET")
        return json(
          await db.document.findMany({
            where: owner,
            select: { id: true, name: true, mime: true, created: true },
            orderBy: { created: "desc" },
          }),
        );
      if (!id && method === "POST") {
        limit(user.id + ":parse", 6);
        if ((await db.document.count({ where: owner })) >= 40)
          return error("documentLimit");
        const file = await upload((await req.formData()).get("file"));
        let sections;
        try {
          sections = chunks(await parseFile(file.buffer, file.ext));
        } catch (e) {
          if (e instanceof FeatureError) throw e;
          throw new FeatureError("parseFailure");
        }
        if (!sections.length) return error("noText", 422);
        const row = await db.document.create({
          data: {
            ...owner,
            name: file.name,
            mime: file.ext,
            original: new Uint8Array(file.buffer),
            chunks: { create: sections },
          },
          select: { id: true, name: true, mime: true, created: true },
        });
        return json(row, 201);
      }
      if (id && detail && method === "GET") {
        const chunk = await db.chunk.findFirst({
          where: { id: detail, docId: id, doc: owner },
          select: {
            text: true,
            section: true,
            doc: { select: { name: true } },
          },
        });
        return chunk ? json(chunk) : error("notFound", 404);
      }
      if (id && !detail && method === "GET") {
        const doc = await db.document.findFirst({
          where: { ...owner, id },
          select: { id: true, name: true, mime: true, created: true },
        });
        return doc ? json(doc) : error("notFound", 404);
      }
      if (id && !detail && method === "DELETE") {
        const result = await db.document.deleteMany({
          where: { ...owner, id },
        });
        return result.count ? json({ ok: true }) : error("notFound", 404);
      }
    }
    if (route === "ask" && method === "POST" && !id) {
      limit(user.id + ":ask", 25);
      const { question } = z
        .object({ question: z.string().trim().min(2).max(300) })
        .parse(await req.json());
      const stored = await db.chunk.findMany({
        where: { doc: { userId: user.id } },
        include: { doc: { select: { name: true, mime: true } } },
      });
      const sources: Source[] = stored.map((row) => ({
        id: row.id,
        name: row.doc.name,
        section: row.section,
        text: row.text,
        vector: row.vector as string[],
        kind: row.doc.mime,
        url: "/api/documents/" + row.docId + "/" + row.id,
      }));
      for (const entry of knowledge) {
        if (!entry.verified) continue;
        for (const text of [entry.ar, entry.en])
          sources.push({
            id: entry.id,
            name: "MTR",
            section: entry.verified,
            text,
            vector: embed(text),
            kind: "knowledge",
            url: entry.url,
          });
      }
      const citations = answer(question, sources).map(
        ({ vector: _, ...source }) => source,
      );
      return json({ citations, abstained: !citations.length });
    }
    if (route === "camera" && method === "POST" && !id) {
      limit(user.id + ":ocr", 6);
      const file = await upload((await req.formData()).get("file"), true);
      const result = await ocr(file.buffer);
      try {
        const readable = result.words
          .map((word) => (word.confidence >= 65 ? word.text : "[unclear]"))
          .join(" ");
        return json({ ...result, translated: await translate(readable) });
      } catch (e) {
        if (e instanceof FeatureError)
          return json({ ...result, translationError: e.code });
        throw e;
      }
    }
    if (route === "receipt" && method === "POST" && !id) {
      limit(user.id + ":receipt", 10);
      const { buffer } = await upload((await req.formData()).get("file"), true);
      const image = await sharp(buffer, { limitInputPixels: 24000000 })
        .rotate()
        .resize({
          width: 1000,
          height: 1000,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 70 })
        .toBuffer();
      if (image.length > 650000) return error("fileSize");
      return json({
        receipt: "data:image/webp;base64," + image.toString("base64"),
      });
    }
    if (route === "fx" && method === "GET" && !id) {
      limit(user.id + ":fx", 12);
      return json(await fx());
    }
    if (route === "transit" && method === "GET" && id && !detail) {
      limit(user.id + ":transit", 12);
      return json(await getTrain(id));
    }
    if (route === "links" && !detail) {
      if (method === "POST" && !id) {
        const chosen = selection.parse(await req.json());
        const rows = await db.record.findMany({
          where: {
            userId: user.id,
            OR: [
              { kind: "event", id: { in: chosen.events } },
              { kind: "place", id: { in: chosen.places } },
              { kind: "program", id: { in: chosen.program } },
            ],
          },
          select: { id: true },
        });
        if (
          rows.length !==
          new Set([...chosen.events, ...chosen.places, ...chosen.program]).size
        )
          return error("notFound", 404);
        const token = randomBytes(32).toString("base64url");
        const key = hash(token);
        await db.share.create({
          data: { token: key, userId: user.id, selection: chosen },
        });
        return json({ url: "/share/" + token, key });
      }
      if (method === "GET" && !id)
        return json(
          await db.share.findMany({
            where: { userId: user.id },
            select: { token: true, selection: true },
          }),
        );
      if (method === "DELETE" && id) {
        const result = await db.share.deleteMany({
          where: { userId: user.id, token: id },
        });
        return result.count ? json({ ok: true }) : error("notFound", 404);
      }
    }
    if (route === "push" && method === "POST" && !id) {
      if (!pushConfigured()) return error("pushSetup", 503);
      const sub = subscription.parse(await req.json());
      if (!pushEndpoint(sub.endpoint)) return error("invalid");
      await db.subscription.upsert({
        where: { endpoint: sub.endpoint },
        create: { endpoint: sub.endpoint, userId: user.id, data: sub },
        update: { userId: user.id, data: sub },
      });
      return json({ ok: true });
    }
    if (route === "push" && method === "DELETE" && !id) {
      const { endpoint } = z
        .object({ endpoint: z.url() })
        .parse(await req.json());
      await db.subscription.deleteMany({
        where: { userId: user.id, endpoint },
      });
      return json({ ok: true });
    }
    if (route === "calendar" && method === "GET" && id && !detail) {
      const row = await db.record.findFirst({
        where: { userId: user.id, id, kind: "reminder" },
      });
      if (!row?.due) return error("notFound", 404);
      return new Response(
        calendar(models.reminder.parse(row.data).title, row.due.toISOString()),
        {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'attachment; filename="hk-reminder.ics"',
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
    return error("notFound", 404);
  } catch (e) {
    if (e instanceof FeatureError)
      return error(
        e.code,
        e.code === "rateLimit" ? 429 : e.code.endsWith("Setup") ? 503 : 422,
      );
    if (e instanceof z.ZodError || e instanceof SyntaxError)
      return error("invalid");
    return error("serverError", 500);
  }
}
