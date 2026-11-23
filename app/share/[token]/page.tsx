import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { hash } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { models } from "../../../lib/model";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Shared itinerary | Hong Kong Companion",
  robots: { index: false, follow: false },
};
export default async function Shared({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await headers();
  const { token } = await params;
  const link = await db.share.findUnique({ where: { token: hash(token) } });
  if (!link) notFound();
  const selection = link.selection as {
    events: string[];
    places: string[];
    program?: string[];
  };
  const rows = await db.record.findMany({
    where: {
      userId: link.userId,
      OR: [
        { kind: "event", id: { in: selection.events } },
        { kind: "place", id: { in: selection.places } },
        { kind: "program", id: { in: selection.program ?? [] } },
      ],
    },
    select: { kind: true, data: true },
  });
  return (
    <main className="main shared">
      <section className="panel">
        <h1>خطة الرحلة المشتركة</h1>
        <p>Shared itinerary · للقراءة بس</p>
        {rows.map(({ kind, data }, i) => {
          if (kind === "event") {
            const v = models.event.parse(data);
            return (
              <article className="mini" key={i}>
                <h2 dir="auto">{v.title}</h2>
                <p>
                  <bdi>{v.date}</bdi> · {v.confirmed ? "متأكد" : "مبدئي"}
                </p>
                <p dir="auto">{v.notes}</p>
              </article>
            );
          }
          if (kind === "program") {
            const v = models.program.parse(data);
            return (
              <article className="mini" key={i}>
                <h2>برنامج الصيف في EdUHK</h2>
                <p>
                  <bdi>{v.start}</bdi> – <bdi>{v.end}</bdi> ·{" "}
                  {v.confirmed ? "متأكد" : "مبدئي"}
                </p>
              </article>
            );
          }
          const v = models.place.parse(data);
          return (
            <article className="mini" key={i}>
              <h2>
                {v.ar} · <bdi>{v.en}</bdi>
              </h2>
              <p lang="zh-Hant">{v.zh}</p>
              <p dir="auto">{v.address}</p>
              <p dir="auto">{v.notes}</p>
              <p>
                {v.confirmed
                  ? "متأكد · Confirmed"
                  : "لسه مش متأكد · Unconfirmed"}
              </p>
              <a
                className="secondary"
                href={
                  "https://www.google.com/maps/dir/?api=1&destination=" +
                  encodeURIComponent(v.lat + "," + v.lng)
                }
                rel="noreferrer"
              >
                الاتجاهات · Directions
              </a>
            </article>
          );
        })}
        {!rows.length && (
          <p>العناصر دي مش موجودة دلوقتي. · These items are unavailable.</p>
        )}
      </section>
    </main>
  );
}
