"use client";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  Clock3,
  Download,
  Expand,
  House,
  MapPin,
  Pencil,
  Plane,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { api, errorCode, type Config, type Row } from "./client";
import { ButtonError } from "./forms";
import {
  Add,
  Empty,
  Head,
  directions,
  type Remove,
  type Update,
} from "./tools";
import { labels, type T } from "./words";
import type { Kind } from "../lib/model";
import { calendar } from "../lib/calendar";
import type { Fx } from "../lib/integrations";

type Shared = {
  t: T;
  rows: Row[];
  edit: (kind: Kind, row?: Row) => void;
  remove: Remove;
  online: boolean;
  date: (v: string) => string;
  number: (v: number) => string;
};
function calendarDownload(row: Row) {
  if (!row.due) return;
  const url = URL.createObjectURL(
    new Blob([calendar(row.data.title, row.due)], {
      type: "text/calendar; charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.download = "hk-reminder.ics";
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Label({ t, value }: { t: T; value: string }) {
  return <>{t(...(labels[value] ?? [value, value]))}</>;
}
function Controls({
  row,
  edit,
  remove,
  t,
  online,
  allowDelete = true,
}: {
  row: Row;
  edit: Shared["edit"];
  remove: Remove;
  t: T;
  online: boolean;
  allowDelete?: boolean;
}) {
  const [problem, setProblem] = useState("");
  return (
    <div className="row-controls">
      <button
        className="icon"
        disabled={!online}
        aria-label={t("عدّل", "Edit")}
        onClick={() => edit(row.kind, row)}
      >
        <Pencil size={17} />
      </button>
      {allowDelete && (
        <button
          className="icon danger"
          disabled={!online}
          aria-label={t("امسح", "Delete")}
          onClick={async () => {
            if (!confirm(t("تمسح العنصر ده؟", "Delete this item?"))) return;
            try {
              await remove(row);
            } catch (e) {
              setProblem(errorCode(e));
            }
          }}
        >
          <Trash2 size={17} />
        </button>
      )}
      {problem && <ButtonError code={problem} t={t} />}
    </div>
  );
}
export function status(row: Row, t: T, date: (v: string) => string) {
  return row.data.confirmed && row.data.confirmedAt
    ? t("متأكد يوم ", "Confirmed on ") + date(row.data.confirmedAt)
    : t("لسه مش متأكد", "Unconfirmed");
}
export function Places(props: Shared) {
  const { t, rows, edit, online, date } = props;
  const [large, setLarge] = useState(false);
  const largeButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!large) return;
    closeButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLarge(false);
      if (event.key === "Tab") event.preventDefault();
    };
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("keydown", keydown);
      largeButton.current?.focus();
    };
  }, [large]);
  const home = rows.find((r) => r.kind === "home");
  const places = rows.filter((r) => r.kind === "place");
  const homeText = home && (
    <>
      <h3 dir="ltr">{home.data.en}</h3>
      <p dir="ltr">{home.data.address}</p>
      <h3 lang="zh-Hant" dir="ltr" className="zh">
        {home.data.zh}
      </h3>
      <p lang="zh-Hant" dir="ltr" className="zh">
        {home.data.addressZh}
      </p>
    </>
  );
  return (
    <>
      <section className="panel home-panel">
        <Head
          title={t("رجّعني للسكن", "Take me home")}
          description={t(
            "اعرض العنوان للسواق بالإنجليزي والصيني التقليدي.",
            "Show the driver your address in English and Traditional Chinese.",
          )}
          action={
            online &&
            (!home ? (
              <Add onClick={() => edit("home")}>
                {t("ضيف السكن", "Add accommodation")}
              </Add>
            ) : (
              <Controls {...props} row={home} />
            ))
          }
        />
        {home ? (
          <>
            <div
              className={"notice " + (!home.data.confirmed ? "warning" : "")}
            >
              {status(home, t, date)}
            </div>
            <div className="home-address">{homeText}</div>
            <button
              className="primary"
              ref={largeButton}
              onClick={() => setLarge(true)}
            >
              <Expand size={18} />
              {t("اعرض ملء الشاشة", "Full screen")}
            </button>
          </>
        ) : (
          <Empty
            title={t("لسه مضفتش عنوان السكن", "No accommodation address yet")}
            icon={<House />}
          />
        )}
      </section>
      <section className="panel">
        <Head
          title={t("أماكني", "Saved places")}
          action={
            online && (
              <Add onClick={() => edit("place")}>
                {t("ضيف مكان", "Add place")}
              </Add>
            )
          }
        />
        {!places.length && (
          <Empty
            icon={<MapPin />}
            title={t("أماكنك هتظهر هنا", "Your saved places will appear here")}
          />
        )}
        <div className="card-grid">
          {places.map((row) => (
            <article className="mini" key={row.id}>
              <div className="section-head">
                <h3>{t(row.data.ar, row.data.en)}</h3>
                <Controls {...props} row={row} />
              </div>
              {row.data.zh && <p lang="zh-Hant">{row.data.zh}</p>}
              <p dir="auto">{row.data.address}</p>
              {row.data.notes && <p dir="auto">{row.data.notes}</p>}
              <p className="muted">{status(row, t, date)}</p>
              <a
                className="secondary small"
                href={directions(row.data.lat + "," + row.data.lng)}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={16} />
                {t("الاتجاهات", "Directions")}
              </a>
            </article>
          ))}
        </div>
      </section>
      {large && home && (
        <div
          className="home-full"
          role="dialog"
          aria-modal="true"
          aria-label={t("عنوان السكن", "Accommodation address")}
        >
          <button
            ref={closeButton}
            className="icon"
            aria-label={t("اقفل", "Close")}
            onClick={() => setLarge(false)}
          >
            <X />
          </button>
          <div>
            <p className={"notice " + (!home.data.confirmed ? "warning" : "")}>
              {status(home, t, date)}
            </p>
            {homeText}
          </div>
        </div>
      )}
    </>
  );
}
export function Trip(
  props: Shared & { update: Update; config: Config | null; accountId: string },
) {
  const {
    t,
    rows,
    edit,
    remove,
    online,
    date,
    number,
    update,
    config,
    accountId,
  } = props;
  const [tab, setTab] = useState("timeline"),
    [problem, setProblem] = useState(""),
    [pushState, setPushState] = useState(""),
    [pushBusy, setPushBusy] = useState(false);
  const program = rows.find((r) => r.kind === "program");
  const events = rows
    .filter((r) => r.kind === "event")
    .sort((a, b) => a.data.date.localeCompare(b.data.date));
  const todos = rows.filter((r) => r.kind === "checklist");
  const flights = rows.filter((r) => r.kind === "flight");
  const reminders = rows
    .filter((r) => r.kind === "reminder")
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  function capability() {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    )
      return "unsupportedPush";
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (
      ios &&
      !matchMedia("(display-mode: standalone)").matches &&
      !(navigator as Navigator & { standalone?: boolean }).standalone
    )
      return "unsupportedPush";
    return Notification.permission === "denied" ? "deniedPush" : "";
  }
  useEffect(() => {
    if (tab !== "reminders") return;
    const unavailable = capability();
    if (unavailable) {
      setPushState(unavailable);
      return;
    }
    void navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setPushState(sub ? "enabled" : "");
    });
  }, [tab]);
  async function enable() {
    setProblem("");
    const unavailable = capability();
    if (unavailable) {
      setPushState(unavailable);
      return;
    }
    if (!config?.push) {
      setPushState("pushSetup");
      return;
    }
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "deniedPush" : "");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg?.active) throw new Error("unsupportedPush");
      const key = Uint8Array.from(
        atob(config.push.replace(/-/g, "+").replace(/_/g, "/")),
        (v) => v.charCodeAt(0),
      );
      const previous = await reg.pushManager.getSubscription();
      const sub =
        previous ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        }));
      await api("push", "POST", sub.toJSON());
      reg.active.postMessage({ type: "account", account: accountId });
      setPushState("enabled");
    } catch (e) {
      setProblem(errorCode(e));
    } finally {
      setPushBusy(false);
    }
  }
  return (
    <section className="panel">
      <Head title={t("جدولي وتجهيزاتي", "Schedule and preparation")} />
      <div
        className="switcher"
        role="group"
        aria-label={t("أقسام الرحلة", "Trip sections")}
      >
        {[
          ["timeline", "الجدول", "Timeline"],
          ["tasks", "التجهيزات", "Checklists"],
          ["flights", "الطيران", "Flights"],
          ["reminders", "التذكيرات", "Reminders"],
        ].map(([id, ar, en]) => (
          <button
            key={id}
            aria-pressed={id === tab}
            onClick={() => {
              setProblem("");
              setTab(id);
            }}
          >
            {t(ar, en)}
          </button>
        ))}
      </div>
      {problem && <ButtonError code={problem} t={t} />}
      {tab === "timeline" && (
        <>
          {program && (
            <article className="mini program-card">
              <div className="section-head">
                <h3>{t("برنامج الصيف في EdUHK", "EdUHK summer programme")}</h3>
                <Controls {...props} row={program} allowDelete={false} />
              </div>
              <p>
                <bdi>{date(program.data.start)}</bdi> —{" "}
                <bdi>{date(program.data.end)}</bdi>
              </p>
              <span className="tag">
                {program.data.confirmed
                  ? status(program, t, date)
                  : t("مواعيد مبدئية", "Planned dates")}
              </span>
              <p className="muted">
                {t("القبول", "Admission")} ·{" "}
                <Label t={t} value={program.data.admission} /> ·{" "}
                {program.data.admissionConfirmed
                  ? t("أكدته إنت", "Confirmed by you")
                  : t("لسه مش متأكد", "Unconfirmed")}
              </p>
            </article>
          )}
          <Head
            title={t("الجدول", "Timeline")}
            action={
              online && (
                <Add onClick={() => edit("event")}>
                  {t("ضيف ميعاد", "Add event")}
                </Add>
              )
            }
          />
          {!events.length && (
            <Empty
              icon={<CalendarDays />}
              title={t("لسه مفيش مواعيد شخصية", "No personal events yet")}
            />
          )}
          {events.map((row) => (
            <article className="mini" key={row.id}>
              <div className="section-head">
                <h3 dir="auto">{row.data.title}</h3>
                <Controls {...props} row={row} />
              </div>
              <p>
                {date(row.data.date)} ·{" "}
                <Label t={t} value={row.data.category} /> ·{" "}
                {status(row, t, date)}
              </p>
              {row.data.notes && <p dir="auto">{row.data.notes}</p>}
            </article>
          ))}
        </>
      )}
      {tab === "tasks" && (
        <>
          <Head
            title={t("قوائم التجهيزات", "Checklists")}
            action={
              online && (
                <Add onClick={() => edit("checklist")}>
                  {t("ضيف مهمة", "Add task")}
                </Add>
              )
            }
          />
          {["before", "arrival"].map((group) => {
            const entries = todos.filter((r) => r.data.group === group),
              done = entries.filter((r) => r.data.done).length;
            return (
              <article className="mini" key={group}>
                <div className="section-head">
                  <h3>
                    <Label t={t} value={group} />
                  </h3>
                  <span className="tag">
                    {number(done)} / {number(entries.length)}
                  </span>
                </div>
                <progress
                  value={done}
                  max={entries.length || 1}
                  aria-label={t("المهام اللي خلصت", "Tasks completed")}
                />
                {!entries.length && (
                  <p className="muted">{t("لسه مفيش مهام", "No tasks yet")}</p>
                )}
                {entries.map((row) => (
                  <div className="list-row" key={row.id}>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={row.data.done}
                        disabled={!online}
                        onChange={async (e) => {
                          try {
                            update(
                              await api<Row>(
                                "records/checklist/" + row.id,
                                "PATCH",
                                { ...row.data, done: e.target.checked },
                              ),
                            );
                          } catch (e) {
                            setProblem(errorCode(e));
                          }
                        }}
                      />
                      <span dir="auto">
                        {t(
                          row.data.ar || row.data.en,
                          row.data.en || row.data.ar,
                        )}
                      </span>
                    </label>
                    <Controls {...props} row={row} />
                  </div>
                ))}
              </article>
            );
          })}
        </>
      )}
      {tab === "flights" && (
        <>
          <Head
            title={t("تفاصيل الطيران", "Flight details")}
            action={
              online && (
                <Add onClick={() => edit("flight")}>
                  {t("ضيف رحلة طيران", "Add flight")}
                </Add>
              )
            }
          />
          {!flights.length && (
            <Empty
              icon={<Plane />}
              title={t("لسه مضفتش رحلات طيران", "No flights entered")}
              description={t(
                "دخل تفاصيل الحجز لما تكون معاك.",
                "Enter your booking details when you have them.",
              )}
            />
          )}
          {flights.map((row) => (
            <article className="mini" key={row.id}>
              <div className="section-head">
                <h3>
                  <Label t={t} value={row.data.direction} /> ·{" "}
                  <bdi>
                    {row.data.airline} {row.data.number}
                  </bdi>
                </h3>
                <Controls {...props} row={row} />
              </div>
              <p dir="ltr">
                {row.data.from} → {row.data.to}
              </p>
              <p>
                <bdi>{row.data.depart.replace("T", " ")}</bdi> ·{" "}
                <Label t={t} value={row.data.departZone} />
              </p>
              <p>
                <bdi>{row.data.arrive.replace("T", " ")}</bdi> ·{" "}
                <Label t={t} value={row.data.arriveZone} />
              </p>
              {row.data.reference && (
                <p>
                  {t("رقم الحجز", "Booking reference")}{" "}
                  <bdi>{row.data.reference}</bdi>
                </p>
              )}
              <p className="muted">{status(row, t, date)}</p>
            </article>
          ))}
        </>
      )}
      {tab === "reminders" && (
        <>
          <Head
            title={t("التذكيرات", "Reminders")}
            action={
              online && (
                <Add onClick={() => edit("reminder")}>
                  {t("ضيف تذكير", "Add reminder")}
                </Add>
              )
            }
          />
          <p className="muted">
            {t(
              "التذكيرات جوه التطبيق بتتشاف وهو مفتوح بس. نزّل كل تذكير للتقويم عشان تقدر تضبط تنبيه حتى لو التطبيق مقفول.",
              "In-app reminders are visible while the app is open. Export reminders to your calendar to set alerts for when it’s closed.",
            )}
          </p>
          {!config?.push && online && <ButtonError code="pushSetup" t={t} />}
          {!!pushState &&
            pushState !== "enabled" &&
            pushState !== "pushSetup" && <ButtonError code={pushState} t={t} />}
          {pushState === "enabled" ? (
            <div className="notice">
              <Check size={17} />
              {t(
                "الإشعارات متفعّلة على الجهاز ده",
                "Push is enabled on this device",
              )}
            </div>
          ) : (
            <button
              className="secondary"
              onClick={() => void enable()}
              disabled={
                !online ||
                pushBusy ||
                !config?.push ||
                ["unsupportedPush", "deniedPush"].includes(pushState)
              }
            >
              <Bell size={17} />
              {t("فعّل إشعارات الجهاز", "Enable device notifications")}
            </button>
          )}
          {!reminders.length && (
            <Empty
              icon={<Clock3 />}
              title={t("لسه مفيش تذكيرات", "No reminders yet")}
            />
          )}
          {reminders.map((row) => (
            <article className="mini" key={row.id}>
              <div className="section-head">
                <h3 dir="auto">{row.data.title}</h3>
                <Controls {...{ ...props, remove }} row={row} />
              </div>
              <p>
                <bdi>{row.data.at.replace("T", " ")}</bdi> ·{" "}
                <Label t={t} value={row.data.zone} />
              </p>
              <p className="muted">
                {row.deliveredAt
                  ? t("اتبعت لخدمة الإشعارات", "Accepted by the push service")
                  : new Date(row.due ?? "").getTime() <= Date.now()
                    ? t(
                        "ميعاده عدى والإرسال مش متأكد",
                        "Due, delivery unconfirmed",
                      )
                    : t("مجدول", "Scheduled")}
              </p>
              {row.due &&
                (online ? (
                  <a
                    className="secondary small"
                    href={"/api/calendar/" + row.id}
                    download
                  >
                    <Download size={16} />
                    {t("نزّل للتقويم", "Export to calendar")}
                  </a>
                ) : (
                  <button
                    className="secondary small"
                    onClick={() => calendarDownload(row)}
                  >
                    <Download size={16} />
                    {t("نزّل للتقويم", "Export to calendar")}
                  </button>
                ))}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
export function Expenses(props: Shared) {
  const { t, rows, edit, remove, online, date, number } = props;
  const [fx, setFx] = useState<{ rate: Fx | null; stale: boolean } | null>(
      null,
    ),
    [problem, setProblem] = useState(""),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState("");
  const expenses = rows
    .filter((r) => r.kind === "expense")
    .sort((a, b) => b.data.date.localeCompare(a.data.date));
  const manual = rows.find((r) => r.kind === "rate");
  const current = manual?.data ?? fx?.rate;
  const total =
    expenses.reduce((sum, row) => sum + Math.round(row.data.amount * 100), 0) /
    100;
  const series = (key: "date" | "category") =>
    Object.entries(
      expenses.reduce<Record<string, number>>(
        (all, r) => ({
          ...all,
          [r.data[key]]:
            (all[r.data[key]] ?? 0) + Math.round(r.data.amount * 100),
        }),
        {},
      ),
    );
  async function refresh() {
    setBusy(true);
    setProblem("");
    try {
      setFx(await api("fx"));
    } catch (e) {
      setFx((old) => (old ? { ...old, stale: true } : null));
      setProblem(errorCode(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (online) void refresh();
  }, [online]);
  return (
    <section className="panel">
      <Head
        title={t("مصاريفك", "Expenses")}
        action={
          online && (
            <Add onClick={() => edit("expense")}>
              {t("ضيف مصروف", "Add expense")}
            </Add>
          )
        }
      />
      <div className="balance">
        <span>{t("إجمالي المصاريف", "Total expenses")}</span>
        <strong>
          <bdi>{number(total)} HKD</bdi>
        </strong>
        {current && (
          <p>
            <bdi>{number(total * current.rate)} EGP</bdi> ·{" "}
            {t("سعر الصرف بتاريخ", "Rate dated")} {date(current.date)}
          </p>
        )}
        {!manual && fx?.rate && (
          <p>
            {t("آخر جلب للسعر", "Last fetched")} {date(fx.rate.fetched)}
          </p>
        )}
      </div>
      {problem && (
        <ButtonError code={problem} t={t} retry={() => void refresh()} />
      )}
      {!manual && fx?.stale && (
        <div className="notice warning">
          {fx.rate
            ? t(
                "التحديث فشل. بنعرض آخر سعر متسجّل وتاريخه.",
                "Refresh failed. Showing the last dated rate.",
              )
            : t(
                "السعر مش متاح ولسه مفيش سعر متسجّل.",
                "Rate unavailable. No previously saved rate.",
              )}
        </div>
      )}
      {!online && (
        <div className="notice">
          {t(
            "تحديث سعر الصرف محتاج نت. المصاريف بتظهر أوفلاين لو كنت فعّلت حفظها.",
            "Rate refresh requires internet. Expenses appear offline if you enabled offline storage.",
          )}
        </div>
      )}
      <div className="actions">
        <button
          className="secondary small"
          disabled={!online || busy}
          onClick={() => void refresh()}
        >
          {busy ? t("بيحدّث…", "Refreshing…") : t("حدّث السعر", "Refresh rate")}
        </button>
        <button
          className="secondary small"
          disabled={!online}
          onClick={() => edit("rate", manual)}
        >
          {t("حط سعر يدوي", "Set manual rate")}
        </button>
        {manual && (
          <button
            className="subtle"
            disabled={!online}
            onClick={async () => {
              try {
                await remove(manual);
              } catch (e) {
                setProblem(errorCode(e));
              }
            }}
          >
            {t("شيل السعر اليدوي", "Remove override")}
          </button>
        )}
      </div>
      {!manual && (
        <a
          className="text-link"
          href="https://www.exchangerate-api.com"
          target="_blank"
          rel="noreferrer"
        >
          Rates by ExchangeRate-API
        </a>
      )}
      {!expenses.length && (
        <Empty
          icon={<Wallet />}
          title={t("لسه مفيش مصاريف", "No expenses yet")}
        />
      )}
      {!!expenses.length && (
        <div className="card-grid">
          {(["date", "category"] as const).map((key) => (
            <div className="mini" key={key}>
              <h3>
                {key === "date"
                  ? t("كل يوم", "By day")
                  : t("حسب التصنيف", "By category")}
              </h3>
              {series(key).map(([id, value]) => (
                <div key={id} className="list-row">
                  <span>
                    {key === "date" ? date(id) : <Label t={t} value={id} />}
                  </span>
                  <bdi>{number(value / 100)} HKD</bdi>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {expenses.map((row) => (
        <article className="mini" key={row.id}>
          <Head
            title={row.data.note || t(...labels[row.data.category])}
            action={<Controls {...props} row={row} />}
          />
          <p>
            <bdi>{number(row.data.amount)} HKD</bdi> · {date(row.data.date)} ·{" "}
            <Label t={t} value={row.data.category} />
          </p>
          {row.data.receipt && (
            <button
              className="secondary small"
              onClick={() => setReceipt(row.data.receipt)}
            >
              {t("شوف الإيصال", "View receipt")}
            </button>
          )}
        </article>
      ))}
      {receipt && (
        <div className="overlay" onClick={() => setReceipt("")}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("الإيصال", "Receipt")}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon"
              onClick={() => setReceipt("")}
              aria-label={t("اقفل", "Close")}
            >
              <X />
            </button>
            <img
              className="receipt"
              src={receipt}
              alt={t("صورة الإيصال", "Receipt image")}
            />
          </section>
        </div>
      )}
    </section>
  );
}
