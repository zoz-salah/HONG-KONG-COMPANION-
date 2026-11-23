import { createHash } from "node:crypto";

const stop = new Set(
  "a an and are as at be can do for from how i in is it me of on or that the this to was were what when where which who will with you your please my عند من في عن إلى الى أو او انا أنا هو هي ده دي دا ايه إيه اي أي امتى فين ازاي إزاي هل ممكن كيف متى أين ما على بعد قبل يكون اللي بتاع بتاعة اقدر أقدر اول أول اعمل أعمل".split(
    " ",
  ),
);
const directive =
  /(ignore|disregard|forget|override|bypass|reveal|exfiltrate|execute|run|output|respond|reply|obey|follow|assistant|system prompt|developer message|previous instructions|prompt injection|act as|you are now|new task|new instructions|system\s*:|developer\s*:|تجاهل|اتجاهل|اتبع|هات التعليمات|نف[ذّ]|رد ب|اطبع|اكشف|إكشف|قول للمستخدم)/i;
export function sanitize(text: string) {
  return text
    .normalize("NFKC")
    .replace(
      /[\u0000-\u0009\u000b-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g,
      "",
    )
    .split("\n")
    .flatMap((line) => line.split(/(?<=[.!?؟])\s+/))
    .filter((line) => !directive.test(line))
    .map((line) => line.trim())
    .filter(Boolean);
}
function terms(text: string) {
  return [
    ...new Set(
      (
        text
          .toLowerCase()
          .replace(/[أإآ]/g, "ا")
          .replace(/[\u064b-\u065f\u0640]/g, "")
          .match(/[\p{L}\p{N}]+/gu) ?? []
      ).filter((t) => t.length > 1 && !stop.has(t)),
    ),
  ];
}
const concepts = [
  ["وصول", "اوصل", "وصلت", "arrival", "arrive", "land", "landing"],
  ["تسجيل", "registration", "register", "check-in"],
  ["شنطة", "شنط", "luggage", "baggage", "bag"],
  ["عنوان", "address"],
  ["طوارئ", "emergency"],
  ["باسبور", "passport"],
  ["رحلة", "flight"],
  ["مطار", "airport"],
  ["مكان", "location", "located"],
  ["ميعاد", "وقت", "موعد", "time", "date"],
  ["مواصلات", "transport"],
  ["مكتب", "office", "desk"],
  ["كود", "رمز", "code"],
  ["استلام", "collect", "pickup"],
];
function features(text: string) {
  return [
    ...new Set(
      terms(text).map((word) => {
        const index = concepts.findIndex(
          (group) =>
            group.includes(word) ||
            (word.startsWith("ال") && group.includes(word.slice(2))),
        );
        return index >= 0 ? "concept:" + index : word;
      }),
    ),
  ];
}
export function embed(text: string) {
  return features(text).map((word) =>
    createHash("sha256").update(word).digest("hex").slice(0, 16),
  );
}
export type Source = {
  id: string;
  name: string;
  section: string;
  text: string;
  vector: string[];
  kind?: string;
  url?: string;
};
export function chunks(sections: { section: string; text: string }[]) {
  return sections
    .flatMap(({ section, text }) =>
      sanitize(text)
        .flatMap((line) => line.match(/.{1,700}(?:\s|$)|.{1,700}/gu) ?? [])
        .map((text) => ({ section, text, vector: embed(text) })),
    )
    .slice(0, 2500);
}
export function answer(question: string, sources: Source[]) {
  if (directive.test(question)) return [];
  const query = embed(question);
  const broadArrival =
    query.length === 1 &&
    features(question)[0] === "concept:0" &&
    /(اول|أول|first|when)/i.test(question);
  if (query.length < 2 && !broadArrival) return [];
  return sources
    .map((source) => {
      const vector = new Set(source.vector);
      return {
        source,
        matches: query.filter((term) => vector.has(term)).length,
      };
    })
    .filter((v) => v.matches === query.length)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 3)
    .map((v) => v.source);
}
