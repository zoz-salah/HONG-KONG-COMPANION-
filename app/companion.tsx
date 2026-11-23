"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Ellipsis,
  FileText,
  Globe,
  House,
  LogIn,
  LogOut,
  MapPin,
  MessageCircle,
  Moon,
  Plane,
  Plus,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  TrainFront,
  Wallet,
  WifiOff,
  X,
} from "lucide-react";
import {
  api,
  changeConsent,
  consent,
  errorCode,
  purge,
  savedSnapshot,
  storeSnapshot,
  type Account,
  type Config,
  type Doc,
  type Row,
} from "./client";
import { ButtonError, Editor } from "./forms";
import {
  CameraTool,
  Documents,
  Empty,
  Phrasebook,
  Resources,
  Sharing,
  Transit,
} from "./tools";
import { Expenses, Places, Trip } from "./trip";
import { countdown } from "../lib/clock";
import type { Kind } from "../lib/model";
import { labels, type Locale, type T } from "./words";
import type { Source } from "../lib/grounding";

const tabs = [
  ["chat", MessageCircle],
  ["camera", Camera],
  ["places", MapPin],
  ["trip", CalendarDays],
  ["more", Ellipsis],
] as const;
const utilities = [
  [
    "documents",
    FileText,
    "اسأل عن ورق الجامعة والسفر",
    "Ask questions about your trip files",
  ],
  [
    "expenses",
    Wallet,
    "تابع صرفك بالدولار الهونج كونجي",
    "Track your spending in HKD",
  ],
  [
    "phrasebook",
    BookOpen,
    "جمل كانتوني للمواقف اليومية",
    "Cantonese for everyday situations",
  ],
  [
    "resources",
    CircleHelp,
    "أرقام طوارئ ومصادر رسمية",
    "Emergency numbers and official sources",
  ],
  ["transit", TrainFront, "شوف مواعيد MTR الحية", "See live MTR arrivals"],
  [
    "sharing",
    ArrowUpRight,
    "شارك مواعيد وأماكن تختارها",
    "Share selected events and places",
  ],
  ["privacy", Shield, "ظبط الحفظ الأوفلاين", "Manage offline storage"],
] as const;
type Screen = (typeof tabs)[number][0] | (typeof utilities)[number][0];
type Citation = Omit<Source, "vector">;
type Exchange = { question: string; citations: Citation[]; abstained: boolean };
export default function Companion() {
  const [locale, setLocale] = useState<Locale>("ar"),
    [dark, setDark] = useState(false),
    [screen, setScreen] = useState<Screen>("chat");
  const [account, setAccount] = useState<Account | null>(null),
    [rows, setRows] = useState<Row[]>([]),
    [docs, setDocs] = useState<Doc[]>([]),
    [config, setConfig] = useState<Config | null>(null);
  const [online, setOnline] = useState(true),
    [loading, setLoading] = useState(true),
    [problem, setProblem] = useState(""),
    [cached, setCached] = useState("");
  const [auth, setAuth] = useState<"login" | "register" | null>(null),
    [authBusy, setAuthBusy] = useState(false),
    [authError, setAuthError] = useState("");
  const [editor, setEditor] = useState<{ kind: Kind; row?: Row } | null>(null),
    [allowExpenses, setAllowExpenses] = useState(false),
    [now, setNow] = useState(0);
  const [question, setQuestion] = useState(""),
    [messages, setMessages] = useState<Exchange[]>([]),
    [asking, setAsking] = useState(false),
    [askError, setAskError] = useState(""),
    [citation, setCitation] = useState<Citation | null>(null);
  const [docError, setDocError] = useState("");
  const [dismissedReminders, setDismissedReminders] = useState<string[]>([]);
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const date = (v: string) =>
    new Intl.DateTimeFormat(t("ar-EG", "en-GB"), {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: v.length === 10 ? "UTC" : "Africa/Cairo",
    }).format(new Date(v));
  const number = (n: number) =>
    new Intl.NumberFormat(t("ar-EG", "en-GB"), {
      maximumFractionDigits: 2,
    }).format(n);
  const loadDocs = useCallback(async () => {
    setDocError("");
    try {
      setDocs(await api<Doc[]>("documents"));
    } catch (e) {
      setDocError(errorCode(e));
    }
  }, []);
  const restore = useCallback(() => {
    const old = savedSnapshot();
    if (old) {
      setAccount(old.account);
      setRows(old.rows);
      setCached(old.at);
      setAllowExpenses(consent(old.account.id));
    } else {
      setAccount(null);
      setRows([]);
      setCached("");
    }
    setDocs([]);
    setMessages([]);
    setCitation(null);
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setProblem("");
    if (!navigator.onLine) {
      restore();
      setLoading(false);
      return;
    }
    try {
      if (localStorage.getItem("hk-pending-logout") === "1") {
        await api("logout", "POST");
        await purge();
      }
      const me = await api<Account | null>("me");
      const previous = savedSnapshot();
      if (previous && previous.account.id !== me?.id) await purge();
      setAccount(me);
      setCached("");
      if (me) {
        const data = await api<Row[]>("state");
        setRows(data);
        setAllowExpenses(consent(me.id));
        await loadDocs();
      } else {
        setRows([]);
        setDocs([]);
        setAllowExpenses(false);
      }
      try {
        setConfig(await api<Config>("config"));
      } catch {
        setConfig(null);
      }
    } catch (e) {
      setProblem(errorCode(e));
      if (!navigator.onLine) restore();
    } finally {
      setLoading(false);
    }
  }, [loadDocs, restore]);
  useEffect(() => {
    setLocale(localStorage.getItem("hk-locale") === "en" ? "en" : "ar");
    setDark(localStorage.getItem("hk-theme") === "dark");
    setOnline(navigator.onLine);
    setNow(Date.now());
    void load();
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/service-worker.js")
        .catch(() => {});
    const on = () => {
        setOnline(true);
        void load();
      },
      off = () => {
        setOnline(false);
        restore();
      };
    const switchAccount = (e: StorageEvent) => {
      if (e.key === "hk-account-change") {
        setRows([]);
        setDocs([]);
        setMessages([]);
        setCitation(null);
        setEditor(null);
        setAccount(null);
        void load();
      }
    };
    const clock = setInterval(() => setNow(Date.now()), 30000);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("storage", switchAccount);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("storage", switchAccount);
      clearInterval(clock);
    };
  }, [load, restore]);
  useEffect(() => {
    document.documentElement.lang = locale === "ar" ? "ar-EG" : "en";
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [locale, dark]);
  useEffect(() => {
    if (account && online && !loading && !problem) {
      try {
        if (!storeSnapshot(account, rows)) setProblem("fileSize");
      } catch {
        setProblem("storageFailure");
      }
    }
  }, [rows, account, allowExpenses, online, loading, problem]);
  useEffect(() => {
    if (!editor && !auth && !citation) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]",
        ) ?? [],
      ).filter((el) => !el.hidden && el.getClientRects().length);
    (
      focusable().find((el) => el.matches("input:not([type=file]),select")) ??
      focusable()[0]
    )?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditor(null);
        setAuth(null);
        setCitation(null);
      }
      if (e.key === "Tab") {
        const nodes = focusable(),
          first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", handle);
    return () => {
      window.removeEventListener("keydown", handle);
      if (previous?.isConnected) previous.focus();
    };
  }, [editor, auth, citation]);
  const navigate = (destination: Screen) => {
    setScreen(destination);
    window.scrollTo({ top: 0 });
  };
  const login = (mode: "login" | "register" = "login") => {
    setAuthError("");
    setAuth(mode);
  };
  function signalAccount() {
    localStorage.setItem("hk-account-change", String(Date.now()));
    localStorage.removeItem("hk-account-change");
  }
  async function sign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    const fields = new FormData(event.currentTarget);
    try {
      await api(auth ?? "login", "POST", {
        email: fields.get("email"),
        password: fields.get("password"),
      });
      await purge();
      setMessages([]);
      setQuestion("");
      signalAccount();
      setAuth(null);
      await load();
    } catch (e) {
      setAuthError(errorCode(e));
    } finally {
      setAuthBusy(false);
    }
  }
  async function logout() {
    setProblem("");
    setLoading(true);
    try {
      if (online) {
        const registration = await navigator.serviceWorker
          ?.getRegistration()
          .catch(() => undefined);
        const sub = await registration?.pushManager
          ?.getSubscription()
          .catch(() => null);
        if (sub)
          await api("push", "DELETE", { endpoint: sub.endpoint }).catch(
            () => {},
          );
        await api("logout", "POST");
      } else localStorage.setItem("hk-pending-logout", "1");
      await purge();
      if (!online) localStorage.setItem("hk-pending-logout", "1");
      setAccount(null);
      setRows([]);
      setDocs([]);
      setMessages([]);
      setCitation(null);
      setQuestion("");
      setCached("");
      setAllowExpenses(false);
      navigate("chat");
      signalAccount();
    } catch (e) {
      setProblem(errorCode(e));
    } finally {
      setLoading(false);
    }
  }

  function update(row: Row) {
    setRows((old) =>
      old.some((r) => r.id === row.id)
        ? old.map((r) => (r.id === row.id ? row : r))
        : [...old, row],
    );
  }
  async function remove(row: Row) {
    await api("records/" + row.kind + "/" + row.id, "DELETE");
    setRows((old) => old.filter((r) => r.id !== row.id));
  }
  function edit(kind: Kind, row?: Row) {
    if (!account) {
      login();
      return;
    }
    setEditor({ kind, row });
  }
  async function ask(value: string) {
    if (!account) {
      login();
      return;
    }
    if (!value.trim() || asking) return;
    setAsking(true);
    setAskError("");
    try {
      const result = await api<{ citations: Citation[]; abstained: boolean }>(
        "ask",
        "POST",
        { question: value },
      );
      setMessages((old) => [...old, { question: value, ...result }]);
      setQuestion("");
    } catch (e) {
      setAskError(errorCode(e));
    } finally {
      setAsking(false);
    }
  }
  async function openCitation(source: Citation) {
    if (source.kind === "knowledge") {
      setCitation(source);
      return;
    }
    try {
      const value = await api<{ text: string }>(
        source.url!.replace("/api/", ""),
      );
      setCitation({ ...source, text: value.text });
    } catch (e) {
      setAskError(errorCode(e));
    }
  }
  const program = rows.find((row) => row.kind === "program");
  const current = countdown(
    rows
      .filter((r) => r.kind === "flight")
      .map((r) => r.data as Parameters<typeof countdown>[0][number]),
    now || Date.now(),
  );
  const sectionProps = { t, rows, edit, remove, online, date, number };
  const tabActive = tabs.some(([id]) => id === screen) ? screen : "more";
  const due = rows
    .filter(
      (row) =>
        row.kind === "reminder" &&
        row.due &&
        !dismissedReminders.includes(row.id),
    )
    .find((row) => {
      const age = now - Date.parse(row.due!);
      return age >= 0 && age < 86400000;
    });
  const Chevron = locale === "ar" ? ChevronLeft : ChevronRight;

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-inner">
          <button className="brand" onClick={() => navigate("chat")}>
            <span className="brand-mark">
              <Plane size={21} strokeWidth={2.4} />
            </span>
            <span>
              <strong>{t("رفيق هونج كونج", "Hong Kong Companion")}</strong>
              <small>HONG KONG COMPANION</small>
            </span>
          </button>
          <div className="header-actions">
            <button
              className="language"
              onClick={() => {
                const next = locale === "ar" ? "en" : "ar";
                setLocale(next);
                localStorage.setItem("hk-locale", next);
              }}
              aria-label={t("حوّل للإنجليزي", "Switch to Arabic")}
            >
              <Globe size={17} />
              {t("EN", "عربي")}
            </button>
            <button
              className="icon top-icon"
              onClick={() => {
                setDark(!dark);
                localStorage.setItem("hk-theme", dark ? "light" : "dark");
              }}
              aria-label={
                dark
                  ? t("الوضع الفاتح", "Light mode")
                  : t("الوضع الغامق", "Dark mode")
              }
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            {account ? (
              <button
                className="icon top-icon"
                onClick={() => void logout()}
                aria-label={t("سجّل خروج", "Sign out")}
                title={t("سجّل خروج", "Sign out")}
              >
                <LogOut size={18} />
              </button>
            ) : (
              <button
                className="header-login"
                disabled={!online}
                onClick={() => login()}
              >
                <LogIn size={17} />
                <span>{t("دخول", "Sign in")}</span>
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="main">
        {!online && (
          <div className="notice offline">
            <WifiOff size={19} />
            <span>
              {t(
                "إنت أوفلاين. الشات، الترجمة، مواعيد القطارات وتحديث الصرف محتاجين نت.",
                "You’re offline. Chat, translation, live trains and rate refresh need internet.",
              )}
              {cached && " " + t("آخر مزامنة ", "Last synced ") + date(cached)}
            </span>
          </div>
        )}
        {problem && (
          <ButtonError code={problem} t={t} retry={() => void load()} />
        )}
        {due && (
          <div className="notice" role="status">
            <Bell size={18} />
            <span>
              {t("ميعاد التذكير جه", "Reminder due")} ·{" "}
              <bdi>{due.data.title}</bdi>
            </span>
            <button
              className="subtle small"
              onClick={() => setDismissedReminders((old) => [...old, due.id])}
            >
              {t("إخفاء", "Dismiss")}
            </button>
          </div>
        )}
        {screen === "chat" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="hero-kicker">
                  <span /> {t("رحلة برنامج الصيف", "SUMMER PROGRAMME TRIP")}
                </span>
                <h1>
                  {t("هونج كونج،", "Hong Kong,")}
                  <br />
                  {t("رحلتك تبدأ هنا.", "your trip starts here.")}
                </h1>
                <p>
                  {t(
                    "رفيقك في رحلة برنامج الصيف في جامعة EdUHK.",
                    "Your companion for the EdUHK summer programme trip.",
                  )}
                </p>
                <button
                  className="hero-button"
                  onClick={() => navigate("trip")}
                >
                  <CalendarDays size={18} />
                  {current ? (
                    <>
                      {current.direction === "return"
                        ? t("العودة بعد ", "Return flight in ")
                        : t("السفر بعد ", "Departure in ")}
                      {current.hours >= 24 ? (
                        <>
                          {number(Math.floor(current.hours / 24))}{" "}
                          {t("يوم", "days")}
                        </>
                      ) : (
                        <>
                          {number(current.hours)} {t("ساعة", "hours")}
                        </>
                      )}{" "}
                      ·{" "}
                      {current.confirmed
                        ? t("متأكد", "Confirmed")
                        : t("مبدئي", "Planned")}
                    </>
                  ) : program ? (
                    <>
                      <bdi>{date(program.data.start)}</bdi> –{" "}
                      <bdi>{date(program.data.end)}</bdi>
                      {!program.data.confirmed && " · " + t("مبدئي", "Planned")}
                    </>
                  ) : (
                    t("شوف خطتك", "View trip plan")
                  )}
                </button>
              </div>
              <div className="hero-location">
                <MapPin size={15} />
                <span>VICTORIA HARBOUR</span>
                <span lang="zh-Hant" dir="ltr">
                  維多利亞港
                </span>
              </div>
            </section>
            <div className="home-grid">
              <section className="panel chat-panel">
                <header className="chat-head">
                  <span className="tile-icon mint">
                    <Sparkles size={23} />
                  </span>
                  <div>
                    <h2>{t("اسأل عن رحلتك", "Ask about your trip")}</h2>
                    <p>
                      {t(
                        "إجابات من ورق رحلتك ومصادر واضحة.",
                        "Answers backed by your trip documents and cited sources.",
                      )}
                    </p>
                  </div>
                  <button
                    className="secondary small doc-button"
                    onClick={() => navigate("documents")}
                  >
                    <FileText size={17} />
                    {t("ملفاتي", "My files")}
                  </button>
                </header>
                {loading ? (
                  <div
                    className="skeleton"
                    role="status"
                    aria-label={t("بيحمّل", "Loading")}
                  />
                ) : !messages.length ? (
                  <div className="chat-empty">
                    <span className="chat-empty-icon">
                      <MessageCircle size={27} />
                    </span>
                    <h3>
                      {t(
                        "أهلاً! جاهز نجهّز لرحلتك؟",
                        "Hi! Ready to plan your trip?",
                      )}
                    </h3>
                    <p>
                      {t(
                        "ارفع ملفات الرحلة واسأل عن اللي مكتوب فيها.",
                        "Upload your trip files and ask about what’s inside.",
                      )}
                    </p>
                    <button
                      className="text-link"
                      onClick={() => navigate("documents")}
                    >
                      <Plus size={16} />
                      {t("ضيف ملفات الرحلة", "Add trip documents")}
                    </button>
                  </div>
                ) : (
                  <div className="messages" aria-live="polite">
                    {messages.map((v, i) => (
                      <div key={i} className="exchange">
                        <p className="question-bubble" dir="auto">
                          {v.question}
                        </p>
                        <div className="answer-bubble">
                          {v.abstained ? (
                            <p>
                              {t(
                                "الملفات اللي عندي مش فيها المعلومة دي. جرّب ترفع الملف اللي فيه التفاصيل، أو راجع تعليمات الجامعة أو الجهة المسؤولة.",
                                "I couldn’t find that in your documents. Try uploading the relevant file or checking with the university or responsible organisation.",
                              )}
                            </p>
                          ) : (
                            <>
                              <p>
                                {t(
                                  "ده اللي لقيته في المصادر:",
                                  "Here’s what I found in the sources:",
                                )}
                              </p>
                              {v.citations.map((source, j) => (
                                <div key={j}>
                                  <blockquote dir="auto">
                                    {source.text}
                                  </blockquote>
                                  <button
                                    className="source"
                                    onClick={() => void openCitation(source)}
                                  >
                                    <FileText size={14} />
                                    <bdi>{source.name}</bdi> ·{" "}
                                    {source.kind === "pdf"
                                      ? t("صفحة", "Page")
                                      : t("قسم", "Section")}{" "}
                                    <bdi>{source.section}</bdi>
                                  </button>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {asking && (
                  <div
                    className="skeleton"
                    role="status"
                    aria-label={t("بدوّر في الملفات", "Searching your files")}
                  />
                )}
                {askError && (
                  <ButtonError
                    code={askError}
                    t={t}
                    retry={() => void ask(question)}
                  />
                )}
                <form
                  className="ask-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void ask(question);
                  }}
                >
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    maxLength={300}
                    minLength={2}
                    required
                    disabled={!online || asking}
                    placeholder={t(
                      "مثلاً: أعمل إيه أول ما أوصل؟",
                      "For example: What should I do when I arrive?",
                    )}
                    aria-label={t("سؤالك عن الرحلة", "Your trip question")}
                  />
                  <button
                    aria-label={t("ابعت السؤال", "Send question")}
                    disabled={!online || asking || question.trim().length < 2}
                  >
                    <ArrowUp size={20} />
                  </button>
                </form>
              </section>
              <aside className="quick">
                <div className="quick-title">
                  <h2>{t("في متناول إيدك", "Quick access")}</h2>
                </div>
                {(
                  [
                    [
                      "places",
                      House,
                      "mint",
                      "رجّعني للسكن",
                      "Take me home",
                      "عنوان السكن بالصيني والإنجليزي",
                      "Your address in Chinese and English",
                    ],
                    [
                      "camera",
                      Camera,
                      "rose",
                      "افهم اللي قدامك",
                      "Read a sign",
                      "اقرأ يافطة أو منيو بالكاميرا",
                      "Scan a sign or menu with your camera",
                    ],
                    [
                      "trip",
                      CalendarDays,
                      "blue",
                      "جدولي وتجهيزاتي",
                      "Schedule and prep",
                      "مواعيد، تجهيزات وتذكيرات",
                      "Events, checklists and reminders",
                    ],
                    [
                      "expenses",
                      Wallet,
                      "amber",
                      "مصاريفك",
                      "Expenses",
                      "تابع مصاريفك خلال الرحلة",
                      "Track your spending on the trip",
                    ],
                  ] as const
                ).map(([id, Icon, color, ar, en, descAr, descEn]) => (
                  <button
                    className="quick-link"
                    key={id}
                    onClick={() => navigate(id)}
                  >
                    <span className={"tile-icon " + color}>
                      <Icon size={22} />
                    </span>
                    <span>
                      <strong>{t(ar, en)}</strong>
                      <small>{t(descAr, descEn)}</small>
                    </span>
                    <Chevron size={16} className="quick-chevron" />
                  </button>
                ))}
              </aside>
            </div>
          </>
        )}
        {screen !== "chat" && (
          <div className="subpage">
            {tabActive === "more" && screen !== "more" && (
              <button
                className="text-link back"
                onClick={() => navigate("more")}
              >
                <Chevron size={16} />
                {t("المزيد", "More")}
              </button>
            )}
            {loading && (
              <div
                className="skeleton panel"
                role="status"
                aria-label={t("بيحمّل", "Loading")}
              />
            )}
            {screen === "more" && (
              <section className="panel">
                <h1>{t("المزيد", "More")}</h1>
                <div className="card-grid">
                  {utilities.map(([id, Icon, ar, en]) => (
                    <button
                      className="quick-link"
                      key={id}
                      onClick={() => navigate(id)}
                    >
                      <span className="tile-icon mint">
                        <Icon size={21} />
                      </span>
                      <span>
                        <strong>{t(...labels[id])}</strong>
                        <small>{t(ar, en)}</small>
                      </span>
                      <Chevron size={16} className="quick-chevron" />
                    </button>
                  ))}
                </div>
              </section>
            )}
            {!loading &&
            !account &&
            ["documents", "places", "trip", "expenses", "sharing"].includes(
              screen,
            ) ? (
              <section className="panel">
                <Empty
                  icon={<ShieldCheck />}
                  title={t(
                    "سجّل دخول عشان تحفظ بيانات رحلتك",
                    "Sign in to save your trip data",
                  )}
                />
                {online && (
                  <div className="actions centered">
                    <button className="primary" onClick={() => login()}>
                      {t("سجّل دخول", "Sign in")}
                    </button>
                    <button
                      className="secondary"
                      onClick={() => login("register")}
                    >
                      {t("اعمل حساب", "Create account")}
                    </button>
                  </div>
                )}
              </section>
            ) : (
              !loading && (
                <>
                  {screen === "camera" &&
                    (account ? (
                      <CameraTool t={t} online={online} config={config} />
                    ) : (
                      <section className="panel">
                        <Empty
                          icon={<Camera />}
                          title={t(
                            "سجّل دخول عشان تقرأ صورة",
                            "Sign in to scan a photo",
                          )}
                        />
                        {online && (
                          <button className="primary" onClick={() => login()}>
                            {t("سجّل دخول", "Sign in")}
                          </button>
                        )}
                      </section>
                    ))}
                  {screen === "places" && <Places {...sectionProps} />}
                  {screen === "trip" && account && (
                    <Trip
                      {...sectionProps}
                      config={config}
                      update={update}
                      accountId={account.id}
                    />
                  )}
                  {screen === "documents" && (
                    <>
                      {docError && (
                        <ButtonError
                          code={docError}
                          t={t}
                          retry={() => void loadDocs()}
                        />
                      )}
                      <Documents
                        t={t}
                        docs={docs}
                        load={loadDocs}
                        online={online}
                      />
                    </>
                  )}
                  {screen === "expenses" && <Expenses {...sectionProps} />}
                  {screen === "phrasebook" && (
                    <Phrasebook
                      t={t}
                      rows={rows}
                      update={update}
                      remove={remove}
                      online={online && !!account}
                    />
                  )}
                  {screen === "resources" && (
                    <Resources
                      t={t}
                      rows={rows}
                      update={update}
                      online={online && !!account}
                      formatDate={date}
                    />
                  )}
                  {screen === "transit" &&
                    (account ? (
                      <Transit
                        t={t}
                        rows={rows}
                        update={update}
                        remove={remove}
                        online={online}
                        number={number}
                      />
                    ) : (
                      <section className="panel">
                        <Empty
                          icon={<TrainFront />}
                          title={t(
                            "سجّل دخول عشان تشوف مواعيد القطارات",
                            "Sign in to see live train times",
                          )}
                        />
                        {online && (
                          <button className="primary" onClick={() => login()}>
                            {t("سجّل دخول", "Sign in")}
                          </button>
                        )}
                      </section>
                    ))}
                  {screen === "sharing" && (
                    <Sharing t={t} rows={rows} online={online} />
                  )}
                  {screen === "privacy" && (
                    <section className="panel">
                      <h1>{t("الخصوصية", "Privacy")}</h1>
                      <p>
                        {t(
                          "ملفاتك بتتقرأ على سيرفر التطبيق، والشات بيطلع مقتطفات منها من غير ما يبعتها لخدمة ذكاء اصطناعي.",
                          "Trip documents are parsed on the app server. Chat retrieves excerpts locally without sending them to an AI service.",
                        )}
                      </p>
                      <p>
                        {t(
                          "صور الكاميرا بتتقرأ بـ Tesseract على السيرفر. لو الترجمة متظبطة، النص اللي اتقري بس بيتبعت لسيرفر Ollama اللي حدده مدير التطبيق.",
                          "Camera images are processed by Tesseract on the server. When translation is configured, extracted text goes to the operator’s configured Ollama server.",
                        )}
                      </p>
                      <p>
                        {t(
                          "الأماكن والسكن والجدول وقوائم التجهيزات بيتحفظوا على الجهاز بعد المزامنة. بنمسح بيانات الحساب دي لما تسجّل خروج.",
                          "Places, accommodation, itinerary and checklists are stored on this device after syncing. This account data is cleared at sign-out.",
                        )}
                      </p>
                      <p>
                        {t(
                          "ملفاتك المرفوعة وسجل الشات مالهمش حفظ أوفلاين.",
                          "Uploaded documents and chat history are excluded from offline storage.",
                        )}
                      </p>
                      {account && (
                        <label className="check-field notice">
                          <input
                            type="checkbox"
                            checked={allowExpenses}
                            onChange={(e) => {
                              changeConsent(account.id, e.target.checked);
                              setAllowExpenses(e.target.checked);
                              if (!online) {
                                const snapshot = savedSnapshot();
                                if (snapshot)
                                  storeSnapshot(account, snapshot.rows);
                                setRows((old) =>
                                  e.target.checked
                                    ? old
                                    : old.filter((r) => r.kind !== "expense"),
                                );
                              }
                            }}
                          />
                          {t(
                            "احفظ المصاريف (المبالغ، الملاحظات، التواريخ، التصنيفات وصور الإيصالات لو المساحة تكفي) على الجهاز ده للأوفلاين.",
                            "Store expenses (amounts, notes, dates, categories and receipts where space allows) on this device for offline use.",
                          )}
                        </label>
                      )}
                    </section>
                  )}
                </>
              )
            )}
          </div>
        )}
      </main>
      <nav
        className="bottom"
        aria-label={t("التنقل الرئيسي", "Main navigation")}
      >
        <div>
          {tabs.map(([id, Icon]) => (
            <button
              key={id}
              aria-current={tabActive === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <span>
                <Icon size={22} strokeWidth={tabActive === id ? 2.4 : 1.9} />
              </span>
              <strong>{t(...labels[id])}</strong>
            </button>
          ))}
        </div>
      </nav>
      {auth && (
        <div className="overlay" onClick={() => setAuth(null)}>
          <section
            className="modal auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="section-head">
              <div>
                <span className="tile-icon mint">
                  <ShieldCheck size={23} />
                </span>
                <h2 id="auth-title">
                  {auth === "login"
                    ? t("سجّل دخول", "Sign in")
                    : t("اعمل حساب", "Create an account")}
                </h2>
                <p>
                  {t(
                    "كل بيانات رحلتك في حسابك الخاص.",
                    "Your trip data stays in your private account.",
                  )}
                </p>
              </div>
              <button
                className="icon"
                onClick={() => setAuth(null)}
                aria-label={t("اقفل", "Close")}
              >
                <X />
              </button>
            </header>
            <form onSubmit={sign}>
              <label>
                {t("الإيميل", "Email")}
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  dir="ltr"
                  required
                  maxLength={254}
                />
              </label>
              <label>
                {t("الباسورد", "Password")}
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    auth === "login" ? "current-password" : "new-password"
                  }
                  dir="ltr"
                  required
                  minLength={10}
                  maxLength={120}
                />
              </label>
              {auth === "register" && (
                <p className="muted">
                  {t(
                    "اختار باسورد فيه ١٠ حروف على الأقل.",
                    "Use at least 10 characters.",
                  )}
                </p>
              )}
              {authError && <ButtonError code={authError} t={t} />}
              <button className="primary" disabled={authBusy || !online}>
                {authBusy
                  ? t("ثواني…", "One moment…")
                  : auth === "login"
                    ? t("دخول", "Sign in")
                    : t("اعمل حساب", "Create account")}
              </button>
            </form>
            <button
              className="text-link"
              onClick={() => login(auth === "login" ? "register" : "login")}
            >
              {auth === "login"
                ? t("جديد هنا؟ اعمل حساب", "New here? Create an account")
                : t("عندك حساب؟ سجّل دخول", "Already registered? Sign in")}
            </button>
          </section>
        </div>
      )}
      {editor && (
        <Editor
          kind={editor.kind}
          row={editor.row}
          t={t}
          close={() => setEditor(null)}
          saved={update}
        />
      )}
      {citation && (
        <div className="overlay" onClick={() => setCitation(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="citation-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="section-head">
              <h2 id="citation-title">
                <bdi>{citation.name}</bdi>
              </h2>
              <button
                className="icon"
                aria-label={t("اقفل", "Close")}
                onClick={() => setCitation(null)}
              >
                <X />
              </button>
            </header>
            <p>
              {citation.kind === "pdf"
                ? t("صفحة", "Page")
                : t("قسم", "Section")}{" "}
              {citation.section}
            </p>
            <blockquote dir="auto">{citation.text}</blockquote>
            {citation.kind === "knowledge" && (
              <a
                className="text-link"
                href={citation.url}
                target="_blank"
                rel="noreferrer"
              >
                {t("المصدر الرسمي", "Official source")}
              </a>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
