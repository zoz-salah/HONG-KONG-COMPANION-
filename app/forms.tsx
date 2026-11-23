"use client";
import { useState, type FormEvent } from "react";
import { X, Save } from "lucide-react";
import type { Kind } from "../lib/model";
import { api, errorCode, fileBody, type Row } from "./client";
import { issues, labels, type T } from "./words";
const zones = ["Africa/Cairo", "Asia/Hong_Kong"];
type Field = [string, string | string[], (string | boolean)?];
const definitions: Partial<Record<Kind, Field[]>> = {
  place: [
    ["ar", "text"],
    ["en", "text"],
    ["zh", "text", ""],
    ["address", "text"],
    ["notes", "text", ""],
    ["lat", "number"],
    ["lng", "number"],
    ["confirmed", "checkbox"],
  ],
  home: [
    ["en", "text"],
    ["zh", "text"],
    ["address", "text"],
    ["addressZh", "text"],
    ["confirmed", "checkbox"],
  ],
  program: [
    ["start", "date"],
    ["end", "date"],
    ["admission", ["unknown", "pending", "accepted", "declined"]],
    ["admissionConfirmed", "checkbox"],
    ["confirmed", "checkbox"],
  ],
  event: [
    ["title", "text"],
    ["date", "date"],
    ["category", ["class", "deadline", "personal", "program"]],
    ["notes", "text", ""],
    ["confirmed", "checkbox"],
  ],
  checklist: [
    ["ar", "text", ""],
    ["en", "text", ""],
    ["group", ["before", "arrival"]],
    ["done", "checkbox"],
  ],
  flight: [
    ["direction", ["outbound", "return"]],
    ["airline", "text"],
    ["number", "text"],
    ["from", "text"],
    ["to", "text"],
    ["depart", "datetime-local"],
    ["departZone", zones],
    ["arrive", "datetime-local"],
    ["arriveZone", zones, "Asia/Hong_Kong"],
    ["reference", "text", ""],
    ["confirmed", "checkbox"],
  ],
  expense: [
    ["amount", "number"],
    ["category", ["food", "transport", "stay", "shopping", "other"]],
    ["note", "text", ""],
    ["date", "date"],
    ["receipt", "file", ""],
  ],
  rate: [
    ["rate", "number"],
    ["date", "date"],
  ],
  reminder: [
    ["title", "text"],
    ["at", "datetime-local"],
    ["zone", zones],
  ],
};
export function ButtonError({
  code,
  t,
  retry,
}: {
  code: string;
  t: T;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="notice error">
      <span>{t(...(issues[code] ?? issues.serverError))}</span>
      {retry && (
        <button className="subtle" onClick={retry}>
          {t("جرّب تاني", "Retry")}
        </button>
      )}
    </div>
  );
}
export function Editor({
  kind,
  row,
  t,
  close,
  saved,
}: {
  kind: Kind;
  row?: Row;
  t: T;
  close: () => void;
  saved: (row: Row) => void;
}) {
  const [busy, setBusy] = useState(false),
    [problem, setProblem] = useState("");
  const [confirmation, setConfirmation] = useState(!!row?.data.confirmed),
    [admission, setAdmission] = useState(!!row?.data.admissionConfirmed);
  const fields = definitions[kind] ?? [];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setProblem("");
    try {
      const values: Record<string, unknown> = {};
      for (const [key, type] of fields) {
        if (type === "file") {
          const file = data.get(key);
          if (file instanceof File && file.size)
            values.receipt = (
              await api<{ receipt: string }>("receipt", "POST", fileBody(file))
            ).receipt;
        } else if (type === "checkbox") values[key] = data.get(key) === "on";
        else values[key] = data.get(key) ?? "";
      }
      saved(
        await api<Row>(
          "records/" + kind + (row ? "/" + row.id : ""),
          row ? "PATCH" : "POST",
          values,
        ),
      );
      close();
    } catch (error) {
      setProblem(errorCode(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay" onClick={close}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        className="modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="section-head">
          <h2 id="editor-title">
            {row ? t("عدّل", "Edit") : t("ضيف", "Add")} {t(...labels[kind])}
          </h2>
          <button
            type="button"
            className="icon"
            aria-label={t("اقفل", "Close")}
            onClick={close}
          >
            <X />
          </button>
        </header>
        <form
          onSubmit={submit}
          onChange={(event) => {
            const target = event.target;
            if (!(
              target instanceof HTMLInputElement ||
              target instanceof HTMLSelectElement
            ))
              return;
            if (!["confirmed", "admissionConfirmed"].includes(target.name)) {
              if (target.name === "admission") setAdmission(false);
              else setConfirmation(false);
            }
          }}
        >
          <div className="field-grid">
            {fields.map(([key, type, initial]) => {
              const label =
                key === "rate"
                  ? t("السعر (جنيه لكل دولار هونج كونجي)", "EGP per HKD")
                  : t(...(labels[key] ?? [key, key]));
              const value =
                row?.data[key] ??
                initial ??
                (Array.isArray(type)
                  ? type[0]
                  : type === "date" && kind !== "program"
                    ? new Date().toLocaleDateString("en-CA", {
                        timeZone: "Africa/Cairo",
                      })
                    : "");
              if (type === "checkbox")
                return (
                  <label className="check-field" key={key}>
                    <input
                      name={key}
                      type="checkbox"
                      {...(key === "confirmed"
                        ? {
                            checked: confirmation,
                            onChange: (
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => setConfirmation(e.target.checked),
                          }
                        : key === "admissionConfirmed"
                          ? {
                              checked: admission,
                              onChange: (
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) => setAdmission(e.target.checked),
                            }
                          : { defaultChecked: !!row?.data[key] })}
                    />
                    {label}
                  </label>
                );
              return (
                <label key={key}>
                  {label}
                  {Array.isArray(type) ? (
                    <select name={key} defaultValue={String(value)}>
                      {type.map((choice) => (
                        <option key={choice} value={choice}>
                          {t(...(labels[choice] ?? [choice, choice]))}
                        </option>
                      ))}
                    </select>
                  ) : type === "file" ? (
                    <input
                      name={key}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/tiff"
                    />
                  ) : (
                    <input
                      dir={
                        ["datetime-local", "date", "number"].includes(type)
                          ? "ltr"
                          : undefined
                      }
                      name={key}
                      type={type}
                      step={type === "number" ? "any" : undefined}
                      defaultValue={String(value)}
                      required={initial !== ""}
                      maxLength={300}
                    />
                  )}
                </label>
              );
            })}
          </div>
          {problem && <ButtonError code={problem} t={t} />}
          <button className="primary" disabled={busy}>
            <Save size={17} />
            {busy ? t("بيتحفظ…", "Saving…") : t("احفظ", "Save")}
          </button>
        </form>
      </section>
    </div>
  );
}
