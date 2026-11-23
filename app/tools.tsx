"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Camera,
  Clipboard,
  FileText,
  ImagePlus,
  MapPin,
  Plus,
  RefreshCw,
  Star,
  TrainFront,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  api,
  errorCode,
  fileBody,
  type Config,
  type Doc,
  type Row,
} from "./client";
import { ButtonError } from "./forms";
import { labels, type T } from "./words";
import type { Word } from "../lib/documents";
import stations from "../data/stations.json";
import phrases from "../data/phrases.json";
import resources from "../data/resources.json";

export const directions = (q: string) =>
  "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(q);
export type Update = (row: Row) => void;
export type Remove = (row: Row) => Promise<void>;
export function Empty({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
  );
}
export function Head({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="section-head">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function Add({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="primary small" onClick={onClick}>
      <Plus size={18} />
      {children}
    </button>
  );
}
export function Documents({
  t,
  docs,
  load,
  online,
}: {
  t: T;
  docs: Doc[];
  load: () => Promise<void>;
  online: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [problem, setProblem] = useState(""),
    [selected, setSelected] = useState<File | null>(null);
  const field = useRef<HTMLInputElement>(null);
  async function run(file: File) {
    setSelected(file);
    setBusy(true);
    setProblem("");
    try {
      await api("documents", "POST", fileBody(file));
      await load();
      setSelected(null);
    } catch (e) {
      setProblem(errorCode(e));
    } finally {
      setBusy(false);
      if (field.current) field.current.value = "";
    }
  }
  async function drop(doc: Doc) {
    if (
      !window.confirm(
        t("تمسح الملف ومصادره؟", "Delete this document and its sources?"),
      )
    )
      return;
    setBusy(true);
    setProblem("");
    try {
      await api("documents/" + doc.id, "DELETE");
      await load();
    } catch (e) {
      setProblem(errorCode(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <Head
        title={t("ملفات الرحلة", "Trip documents")}
        description={t(
          "ضيف ملفاتك عشان تقدر تسأل عنها.",
          "Add documents to ask questions about them.",
        )}
        action={
          <button
            className="primary small"
            onClick={() => field.current?.click()}
            disabled={!online || busy}
          >
            <Upload size={17} />
            {t("ارفع ملف", "Upload file")}
          </button>
        }
      />
      <input
        hidden
        ref={field}
        type="file"
        accept=".pdf,.docx,.txt,.png,.jpeg,.jpg,.webp,.tiff"
        onChange={(e) => {
          if (e.target.files?.[0]) void run(e.target.files[0]);
        }}
      />
      <p className="muted">
        PDF · DOCX · TXT · JPG · PNG · WEBP · TIFF ·{" "}
        {t("لحد ٨ ميجابايت", "Up to 8 MB")}
      </p>
      {!online && <ButtonError code="offline" t={t} />}
      {busy && (
        <div
          className="skeleton"
          role="status"
          aria-label={t("بيحمّل", "Loading")}
        />
      )}
      {problem && (
        <ButtonError
          code={problem}
          t={t}
          retry={selected ? () => void run(selected) : () => void load()}
        />
      )}
      {!docs.length && !busy && (
        <Empty
          icon={<FileText />}
          title={t("لسه مفيش ملفات", "No documents yet")}
        />
      )}
      {docs.map((doc) => (
        <article className="list-row" key={doc.id}>
          <FileText size={19} />
          <bdi>{doc.name}</bdi>
          <span className="tag">{doc.mime.toUpperCase()}</span>
          <button
            className="icon danger"
            disabled={!online || busy}
            aria-label={t("امسح الملف", "Delete document")}
            onClick={() => void drop(doc)}
          >
            <Trash2 size={17} />
          </button>
        </article>
      ))}
    </section>
  );
}
type Scan = {
  words: Word[];
  text: string;
  width: number;
  height: number;
  image: string;
  translated?: { translation: string; explanation: string };
  translationError?: string;
};
export function CameraTool({
  t,
  online,
  config,
}: {
  t: T;
  online: boolean;
  config: Config | null;
}) {
  const [busy, setBusy] = useState(false),
    [problem, setProblem] = useState(""),
    [result, setResult] = useState<Scan | null>(null),
    [live, setLive] = useState(false),
    [selected, setSelected] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null),
    video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null);
  function stop() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setLive(false);
  }
  useEffect(
    () => () => stream.current?.getTracks().forEach((track) => track.stop()),
    [],
  );
  useEffect(() => {
    if (live && video.current && stream.current)
      video.current.srcObject = stream.current;
  }, [live]);
  async function open() {
    setProblem("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem("noCamera");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      setLive(true);
    } catch (e) {
      const key = (e as Error).name;
      setProblem(
        key === "NotAllowedError" || key === "SecurityError"
          ? "deniedCamera"
          : key === "NotFoundError" || key === "OverconstrainedError"
            ? "noCamera"
            : "cameraFailure",
      );
    }
  }
  async function scan(file: File) {
    setProblem("");
    setResult(null);
    setBusy(true);
    setSelected(file);
    try {
      setResult(await api<Scan>("camera", "POST", fileBody(file)));
    } catch (e) {
      setProblem(errorCode(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  function capture() {
    const element = video.current;
    if (!element?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext("2d")?.drawImage(element, 0, 0);
    stop();
    canvas.toBlob(
      (blob) => {
        if (blob)
          void scan(new File([blob], "camera.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.86,
    );
  }
  return (
    <section className="panel">
      <Head
        title={t("افهم اللي قدامك", "Read what’s in front of you")}
        description={t(
          "صوّر يافطة، منيو أو ورقة بالإنجليزي أو بالصيني التقليدي.",
          "Scan a sign, menu or document in English or Traditional Chinese.",
        )}
      />
      <input
        hidden
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/tiff"
        onChange={(e) => {
          if (e.target.files?.[0]) void scan(e.target.files[0]);
        }}
      />
      {!online && <ButtonError code="offline" t={t} />}
      {config?.ocr === false && <ButtonError code="ocrSetup" t={t} />}
      {config?.translation === false && (
        <div className="notice">
          {t(
            "قراءة الصورة متاحة لو Tesseract متثبّت.",
            "Image reading is available when Tesseract is installed.",
          )}{" "}
          {t(
            "عشان تضيف الترجمة، نزّل Ollama من ollama.com وظبط OLLAMA_URL وOLLAMA_MODEL في .env.",
            "To add translation, install Ollama from ollama.com and set OLLAMA_URL and OLLAMA_MODEL in .env.",
          )}
        </div>
      )}
      <div className="actions">
        <button
          className="primary"
          disabled={!online || busy || live || config?.ocr === false}
          onClick={() => void open()}
        >
          <Camera size={18} />
          {t("افتح الكاميرا", "Open camera")}
        </button>
        <button
          className="secondary"
          disabled={!online || busy || config?.ocr === false}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={18} />
          {t("ارفع صورة", "Upload photo")}
        </button>
      </div>
      {live && (
        <div className="capture">
          <video playsInline autoPlay muted ref={video} />
          <div className="actions">
            <button className="primary" onClick={capture}>
              {t("خد الصورة", "Take photo")}
            </button>
            <button className="secondary" onClick={stop}>
              {t("اقفل", "Close")}
            </button>
          </div>
        </div>
      )}
      {problem && (
        <ButtonError
          code={problem}
          t={t}
          retry={
            ["deniedCamera", "noCamera", "cameraFailure"].includes(problem)
              ? () => void open()
              : selected
                ? () => void scan(selected)
                : undefined
          }
        />
      )}
      {busy && (
        <div
          className="skeleton"
          role="status"
          aria-label={t("بنقرأ الصورة", "Reading image")}
        />
      )}
      {!result && !busy && !live && (
        <Empty
          icon={<Camera />}
          title={t("جاهز تقرأ أول صورة؟", "Ready to scan your first image?")}
        />
      )}
      {result && (
        <div className="scan-result">
          <h3>{t("النص اللي اتقري", "Extracted text")}</h3>
          <div dir="auto" className="extracted">
            {result.words.map((word, index) => (
              <span
                key={index}
                className={word.confidence < 65 ? "uncertain" : ""}
                title={
                  word.confidence < 65
                    ? t("قراءة مش مؤكدة", "Uncertain reading")
                    : undefined
                }
              >
                {word.text}{" "}
              </span>
            ))}
          </div>
          <h3>{t("درجة الثقة", "OCR confidence")}</h3>
          <p>
            {new Intl.NumberFormat(t("ar-EG", "en-GB"), {
              style: "percent",
            }).format(
              result.words.reduce((n, w) => n + w.confidence, 0) /
                result.words.length /
                100,
            )}{" "}
            ·{" "}
            {t("الأصفر يعني قراءة مش مؤكدة", "Yellow marks uncertain readings")}
          </p>
          <div className="scan-image">
            <img
              alt={t(
                "الصورة ومناطق النص المشكوك فيه",
                "Image and uncertain text regions",
              )}
              src={result.image}
            />
            {result.words
              .filter((w) => w.confidence < 65)
              .map((w, i) => (
                <span
                  key={i}
                  className="ocr-box"
                  aria-hidden="true"
                  style={{
                    left: (100 * w.x) / result.width + "%",
                    top: (100 * w.y) / result.height + "%",
                    width: (100 * w.width) / result.width + "%",
                    height: (100 * w.height) / result.height + "%",
                  }}
                />
              ))}
          </div>
          <h3>{t("الترجمة والشرح", "Translation and explanation")}</h3>
          {result.translated && (
            <>
              <p>{result.translated.translation}</p>
              <p>{result.translated.explanation}</p>
            </>
          )}
          {result.translationError && (
            <ButtonError
              code={result.translationError}
              t={t}
              retry={
                result.translationError !== "translationSetup" && selected
                  ? () => void scan(selected)
                  : undefined
              }
            />
          )}
        </div>
      )}
    </section>
  );
}
export function Phrasebook({
  t,
  rows,
  update,
  remove,
  online,
}: {
  t: T;
  rows: Row[];
  update: Update;
  remove: Remove;
  online: boolean;
}) {
  const [query, setQuery] = useState(""),
    [only, setOnly] = useState(false),
    [problem, setProblem] = useState("");
  const favorites = rows.filter((row) => row.kind === "phrase");
  const matches = phrases.filter(
    (p) =>
      (!only || favorites.some((row) => row.data.key === p.id)) &&
      [p.ar, p.en, p.zh, p.pronunciation, p.group, t(...labels[p.group])].some(
        (v) => v.toLowerCase().includes(query.toLowerCase().trim()),
      ),
  );
  return (
    <section className="panel">
      <Head title={t("جمل جاهزة", "Cantonese phrasebook")} />
      <div className="notice">
        {t(
          "صياغة الجمل لسه متراجعتش. اتأكد من الجمل المهمة مع حد بيتكلم كانتوني.",
          "These phrases are unverified. Confirm important wording with a Cantonese speaker.",
        )}
      </div>
      <div className="actions phrase-search">
        <input
          aria-label={t("دور على جملة", "Search phrases")}
          placeholder={t("دور على جملة…", "Search phrases…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="check-field">
          <input
            type="checkbox"
            checked={only}
            onChange={(e) => setOnly(e.target.checked)}
          />
          {t("المفضلة", "Favorites")}
        </label>
      </div>
      {problem && <ButtonError code={problem} t={t} />}
      {!matches.length && (
        <Empty title={t("مفيش جمل مطابقة", "No matching phrases")} />
      )}
      <div className="card-grid">
        {matches.map((p) => {
          const favorite = favorites.find((row) => row.data.key === p.id);
          return (
            <article className="mini" key={p.id}>
              <div className="section-head">
                <span className="tag">{t(...labels[p.group])}</span>
                <button
                  className={"icon " + (favorite ? "gold" : "")}
                  aria-pressed={!!favorite}
                  aria-label={t(
                    favorite ? "شيل من المفضلة" : "ضيف للمفضلة",
                    favorite ? "Remove favorite" : "Add favorite",
                  )}
                  disabled={!online}
                  onClick={async () => {
                    setProblem("");
                    try {
                      if (favorite) await remove(favorite);
                      else
                        update(
                          await api<Row>("records/phrase", "POST", {
                            key: p.id,
                          }),
                        );
                    } catch (e) {
                      setProblem(errorCode(e));
                    }
                  }}
                >
                  <Star size={19} fill={favorite ? "currentColor" : "none"} />
                </button>
              </div>
              <strong lang="zh-Hant" dir="ltr" className="zh">
                {p.zh}
              </strong>
              <div dir="ltr" className="mono">
                {p.pronunciation}
              </div>
              <p dir="ltr">{p.en}</p>
              <p dir="rtl">{p.ar}</p>
              <small>{t("لسه متراجعتش", "Unverified")}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}
export function Resources({
  t,
  rows,
  update,
  online,
  formatDate,
}: {
  t: T;
  rows: Row[];
  update: Update;
  online: boolean;
  formatDate: (v: string) => string;
}) {
  const [problem, setProblem] = useState("");
  return (
    <section className="panel">
      <Head
        title={t("الطوارئ وأرقام مهمة", "Emergency and practical resources")}
      />
      {problem && <ButtonError code={problem} t={t} />}
      <div className="card-grid">
        {resources.map((r) => {
          const override = rows.find(
            (row) => row.kind === "resource" && row.data.key === r.id,
          );
          return (
            <article className="mini" key={r.id}>
              <h3>{t(r.ar, r.en)}</h3>
              {r.address && <p dir="auto">{r.address}</p>}
              <p className="muted">
                {r.verified
                  ? t("آخر تحقق رسمي ", "Last officially verified ") +
                    formatDate(r.verified)
                  : t("لسه متأكدناش من البيانات", "Unverified contact details")}
                {override &&
                  " · " +
                    t("راجعتها أنت ", "You checked ") +
                    formatDate(override.data.date)}
              </p>
              <div className="actions">
                {r.phone && (
                  <a className="secondary small" href={"tel:" + r.phone}>
                    {t("اتصل", "Call")} <bdi>{r.phone}</bdi>
                  </a>
                )}
                {r.address && (
                  <a
                    className="secondary small"
                    href={directions(r.address)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin size={15} />
                    {t("الاتجاهات", "Directions")}
                  </a>
                )}
                <a
                  className="text-link"
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("المصدر الرسمي", "Official source")}
                </a>
                {r.phoneSource && (
                  <a
                    className="text-link"
                    href={r.phoneSource}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("مصدر رقم التليفون", "Phone source")}
                  </a>
                )}
              </div>
              <form
                className="actions"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  setProblem("");
                  try {
                    update(
                      await api<Row>("records/resource", "POST", {
                        key: r.id,
                        date: d.get("date"),
                      }),
                    );
                  } catch (e) {
                    setProblem(errorCode(e));
                  }
                }}
              >
                <label className="resource-date">
                  {t("تاريخ مراجعتك", "Your verification date")}
                  <input
                    name="date"
                    type="date"
                    dir="ltr"
                    required
                    defaultValue={override?.data.date}
                  />
                </label>
                <button className="secondary small" disabled={!online}>
                  {t("سجّل", "Save")}
                </button>
              </form>
            </article>
          );
        })}
      </div>
    </section>
  );
}
type Trains = {
  at: string;
  up: { dest: string; plat: string; time: string; ttnt: string }[];
  down: { dest: string; plat: string; time: string; ttnt: string }[];
};
const lines: Record<string, string> = {
  AEL: "Airport Express",
  TCL: "Tung Chung",
  TML: "Tuen Ma",
  TKL: "Tseung Kwan O",
  EAL: "East Rail",
  SIL: "South Island",
  TWL: "Tsuen Wan",
  ISL: "Island",
  KTL: "Kwun Tong",
  DRL: "Disneyland Resort",
};
export function Transit({
  t,
  rows,
  update,
  remove,
  online,
  number,
}: {
  t: T;
  rows: Row[];
  update: Update;
  remove: Remove;
  online: boolean;
  number: (n: number) => string;
}) {
  const [line, setLine] = useState<keyof typeof stations>("EAL"),
    [stop, setStop] = useState("TAP"),
    [query, setQuery] = useState(""),
    [train, setTrain] = useState<Trains | null>(null),
    [problem, setProblem] = useState(""),
    [busy, setBusy] = useState(false);
  const key = line + "-" + stop;
  const pins = rows.filter((r) => r.kind === "station");
  const pin = pins.find((r) => r.data.key === key);
  async function refresh(k: string) {
    setBusy(true);
    setProblem("");
    try {
      setTrain(await api<Trains>("transit/" + k));
    } catch (e) {
      setTrain(null);
      setProblem(errorCode(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!query || !online) return;
    const interval = setInterval(() => void refresh(query), 30000);
    return () => clearInterval(interval);
  }, [query, online]);
  function select(k: string) {
    const [l, s] = k.split("-");
    setLine(l as keyof typeof stations);
    setStop(s);
    setTrain(null);
    setQuery(k);
    void refresh(k);
  }
  return (
    <section className="panel">
      <Head
        title={t("مواعيد MTR الحية", "Live MTR arrivals")}
        description={t(
          "من خدمة MTR الرسمية للمحطات اللي بتغطيها.",
          "From the official MTR feed for supported stations.",
        )}
      />
      {!online && <ButtonError code="offline" t={t} />}
      <div className="field-grid">
        <label>
          {t("الخط", "Line")}
          <select
            value={line}
            onChange={(e) => {
              const l = e.target.value as keyof typeof stations;
              setLine(l);
              setStop(stations[l]?.[0]?.[0] ?? "");
              setQuery("");
              setTrain(null);
            }}
          >
            {Object.keys(stations).map((l) => (
              <option value={l} key={l}>
                {lines[l]}
              </option>
            ))}
            <option value="unsupported">{t("خط تاني", "Other line")}</option>
          </select>
        </label>
        <label>
          {t("المحطة", "Station")}
          <select
            value={stop}
            onChange={(e) => {
              setStop(e.target.value);
              setQuery("");
              setTrain(null);
            }}
          >
            {(stations[line] ?? []).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!stations[line] && <ButtonError code="unsupportedStation" t={t} />}
      <div className="actions">
        <button
          className="primary"
          disabled={!stations[line] || !online || busy}
          onClick={() => {
            setQuery(key);
            void refresh(key);
          }}
        >
          <RefreshCw size={17} />
          {t("هات المواعيد", "Get arrivals")}
        </button>
        <button
          className="secondary"
          disabled={!online || !stations[line]}
          aria-pressed={!!pin}
          onClick={async () => {
            try {
              if (pin) await remove(pin);
              else update(await api<Row>("records/station", "POST", { key }));
            } catch (e) {
              setProblem(errorCode(e));
            }
          }}
        >
          <Star size={17} />
          {pin
            ? t("شيل التثبيت", "Unpin station")
            : t("ثبّت المحطة", "Pin station")}
        </button>
      </div>
      {!!pins.length && (
        <div className="actions">
          {pins.map((r) => (
            <button
              className="subtle"
              disabled={!online || busy}
              key={r.id}
              onClick={() => select(r.data.key)}
            >
              {r.data.key}
            </button>
          ))}
        </div>
      )}
      {busy && !train && (
        <div
          className="skeleton"
          role="status"
          aria-label={t("بيحمّل", "Loading")}
        />
      )}
      {problem && (
        <ButtonError
          code={problem}
          t={t}
          retry={() => void refresh(query || key)}
        />
      )}
      {!train && !busy && !problem && stations[line] && (
        <Empty
          icon={<TrainFront />}
          title={t(
            "اختار محطة واعرض المواعيد",
            "Choose a station to see arrivals",
          )}
        />
      )}
      {train && online && (
        <>
          <p className="muted">
            {t("وقت بيانات MTR بتوقيت هونج كونج", "MTR data time in Hong Kong")}{" "}
            <bdi dir="ltr">{train.at}</bdi>
          </p>
          {[...train.up, ...train.down].map((v, i) => (
            <article className="list-row" key={i}>
              <TrainFront size={18} />
              <strong>{v.dest}</strong>
              <span>
                {t("رصيف", "Platform")} {v.plat}
              </span>
              <bdi>{v.time.slice(11, 16)}</bdi>
              <span>
                {number(Number(v.ttnt))} {t("د", "min")}
              </span>
            </article>
          ))}
          {!train.up.length && !train.down.length && (
            <Empty
              title={t(
                "مفيش قطارات ظاهرة دلوقتي",
                "No trains listed right now",
              )}
            />
          )}
        </>
      )}
    </section>
  );
}
type Link = {
  token: string;
  selection: { events: string[]; places: string[]; program?: string[] };
};
export function Sharing({
  t,
  rows,
  online,
}: {
  t: T;
  rows: Row[];
  online: boolean;
}) {
  const [chosen, setChosen] = useState<string[]>([]),
    [links, setLinks] = useState<Link[]>([]),
    [urls, setUrls] = useState<Record<string, string>>({}),
    [problem, setProblem] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState("");
  const shareable = rows.filter(
    (r) => r.kind === "event" || r.kind === "place" || r.kind === "program",
  );
  const preview = shareable.filter((r) => chosen.includes(r.id));
  const sharedDate = (value: string) =>
    new Intl.DateTimeFormat(t("ar-EG", "en-GB"), {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(value));

  async function load() {
    if (!online) return;
    setBusy(true);
    try {
      setLinks(await api<Link[]>("links"));
    } catch (e) {
      setProblem(errorCode(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps
  async function create(event: FormEvent) {
    event.preventDefault();
    setProblem("");
    setBusy(true);
    try {
      const result = await api<{ url: string; key: string }>("links", "POST", {
        events: preview.filter((r) => r.kind === "event").map((r) => r.id),
        places: preview.filter((r) => r.kind === "place").map((r) => r.id),
        program: preview.filter((r) => r.kind === "program").map((r) => r.id),
      });
      setUrls((old) => ({
        ...old,
        [result.key]: location.origin + result.url,
      }));
      setChosen([]);
      await load();
    } catch (e) {
      setProblem(errorCode(e));
    } finally {
      setBusy(false);
    }
  }
  function name(r: Row) {
    return r.kind === "event"
      ? r.data.title
      : r.kind === "program"
        ? t("مواعيد برنامج الصيف", "Summer programme dates")
        : t(r.data.ar, r.data.en);
  }
  return (
    <section className="panel">
      <Head
        title={t("مشاركة الرحلة", "Share itinerary")}
        description={t(
          "اختار المواعيد والأماكن اللي عايز تبعتها. أي حد معاه اللينك يقدر يشوفهم للقراءة بس.",
          "Choose events and places. Anyone with the link can read the selected entries.",
        )}
      />
      {!online && <ButtonError code="offline" t={t} />}
      {problem && (
        <ButtonError code={problem} t={t} retry={() => void load()} />
      )}
      {!shareable.length && (
        <Empty
          title={t("ضيف مكان أو ميعاد الأول", "Add a place or event first")}
        />
      )}
      {!!shareable.length && (
        <form onSubmit={create}>
          <div className="share-options">
            {shareable.map((r) => (
              <label className="check-field" key={r.id}>
                <input
                  type="checkbox"
                  checked={chosen.includes(r.id)}
                  onChange={(e) =>
                    setChosen(
                      e.target.checked
                        ? [...chosen, r.id]
                        : chosen.filter((id) => id !== r.id),
                    )
                  }
                />
                {t(...labels[r.kind])} · {name(r)}
              </label>
            ))}
          </div>
          <p className="muted">
            {t(
              "هيظهر الاسم، التفاصيل، الملاحظات، وعنوان وإحداثيات الأماكن اللي اخترتها. أي تعديل عليها هيظهر في اللينك.",
              "The link shows names, details, notes, and the selected places’ addresses and coordinates. Edits appear on the link.",
            )}
          </p>
          {!!preview.length && (
            <section aria-label={t("معاينة المشاركة", "Share preview")}>
              <h3>{t("هيظهر إيه في اللينك؟", "What the link will show")}</h3>
              {preview.map((r) => (
                <article className="mini" key={r.id}>
                  <strong dir="auto">{name(r)}</strong>
                  {r.kind === "event" && (
                    <p>
                      {sharedDate(r.data.date)} ·{" "}
                      {t(...labels[r.data.category])}
                    </p>
                  )}
                  {r.kind === "program" && (
                    <p>
                      <bdi>{sharedDate(r.data.start)}</bdi> –{" "}
                      <bdi>{sharedDate(r.data.end)}</bdi>
                    </p>
                  )}
                  {r.kind === "place" && (
                    <>
                      <p>
                        {r.data.ar} · <bdi>{r.data.en}</bdi>
                        {r.data.zh && (
                          <>
                            {" "}
                            · <bdi lang="zh-Hant">{r.data.zh}</bdi>
                          </>
                        )}
                      </p>
                      <p dir="auto">{r.data.address}</p>
                      <p dir="ltr">
                        {r.data.lat}, {r.data.lng}
                      </p>
                    </>
                  )}
                  {r.kind !== "program" && r.data.notes && (
                    <p dir="auto">{r.data.notes}</p>
                  )}
                  <span className="tag">
                    {r.data.confirmed
                      ? t("متأكد", "Confirmed")
                      : t("لسه مش متأكد", "Unconfirmed")}
                  </span>
                </article>
              ))}
            </section>
          )}
          <button
            className="primary"
            disabled={!online || busy || !chosen.length}
          >
            {t("اعمل لينك", "Create link")}
          </button>
        </form>
      )}
      {links.map((link) => (
        <article className="mini" key={link.token}>
          <p>
            {[
              ...link.selection.events,
              ...link.selection.places,
              ...(link.selection.program ?? []),
            ]
              .map((id) => shareable.find((r) => r.id === id))
              .filter(Boolean)
              .map((r) => name(r!))
              .join(" · ") || t("العناصر اتمسحت", "Items were deleted")}
          </p>
          {urls[link.token] && (
            <>
              <input
                readOnly
                dir="ltr"
                aria-label={t("لينك المشاركة", "Share link")}
                value={urls[link.token]}
                onFocus={(e) => e.target.select()}
              />
              <div className="actions">
                <a
                  className="secondary small"
                  href={urls[link.token]}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ArrowUpRight size={17} />
                  {t("افتح اللينك", "Open link")}
                </a>
                <button
                  className="secondary small"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(urls[link.token]);
                      setCopied(link.token);
                    } catch {
                      setProblem("invalid");
                    }
                  }}
                >
                  <Clipboard size={16} />
                  {copied === link.token
                    ? t("اتنسخ", "Copied")
                    : t("انسخ", "Copy")}
                </button>
              </div>
            </>
          )}
          <button
            className="secondary small danger"
            disabled={!online || busy}
            onClick={async () => {
              setProblem("");
              try {
                await api("links/" + link.token, "DELETE");
                await load();
              } catch (e) {
                setProblem(errorCode(e));
              }
            }}
          >
            <X size={16} />
            {t("الغي اللينك", "Revoke link")}
          </button>
        </article>
      ))}
      {busy && (
        <div
          className="skeleton"
          role="status"
          aria-label={t("بيحمّل", "Loading")}
        />
      )}
    </section>
  );
}
