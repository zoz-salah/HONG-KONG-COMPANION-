import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mammoth from "mammoth";
import sharp from "sharp";

const execute = promisify(execFile);
export const maxUpload = 8 * 1024 * 1024;
export class FeatureError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
const extensions = [
  "pdf",
  "docx",
  "txt",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "tif",
  "tiff",
];
export async function upload(
  file: FormDataEntryValue | null,
  imageOnly = false,
) {
  if (!(file instanceof File) || !file.size || file.size > maxUpload)
    throw new FeatureError("fileSize");
  const ext = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!extensions.includes(ext) || (imageOnly && extensions.indexOf(ext) < 3))
    throw new FeatureError("fileType");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (ext === "pdf" && !buffer.subarray(0, 5).equals(Buffer.from("%PDF-")))
    throw new FeatureError("fileType");
  if (
    ext === "docx" &&
    !buffer.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))
  )
    throw new FeatureError("fileType");
  if (ext === "txt") {
    try {
      if (/\0/.test(new TextDecoder("utf-8", { fatal: true }).decode(buffer)))
        throw new Error();
    } catch {
      throw new FeatureError("fileType");
    }
  }
  if (extensions.indexOf(ext) >= 3) {
    try {
      const metadata = await sharp(buffer, {
        limitInputPixels: 24000000,
      }).metadata();
      if (
        !metadata.format ||
        !["jpeg", "png", "webp", "tiff"].includes(metadata.format) ||
        (metadata.pages ?? 1) > 1
      )
        throw new Error();
    } catch {
      throw new FeatureError("fileType");
    }
  }
  return {
    buffer,
    ext,
    name: file.name
      .replace(/[\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g, "")
      .slice(-180),
  };
}
async function temporary<T>(
  buffer: Buffer,
  ext: string,
  run: (path: string) => Promise<T>,
) {
  const folder = await mkdtemp(join(tmpdir(), "hk-companion-"));
  const path = join(folder, "upload." + ext);
  try {
    await writeFile(path, buffer);
    return await run(path);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
export type Word = {
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
};
export async function ocrStatus() {
  try {
    const { stdout } = await execute("tesseract", ["--list-langs"], {
      timeout: 5000,
    });
    return ["eng", "chi_tra"].every((lang) =>
      stdout.split(/\r?\n/).includes(lang),
    );
  } catch {
    return false;
  }
}
export async function ocr(buffer: Buffer) {
  if (!(await ocrStatus())) throw new FeatureError("ocrSetup");
  try {
    const image = await sharp(buffer, { limitInputPixels: 24000000 })
      .rotate()
      .resize({
        width: 1800,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer({ resolveWithObject: true });
    const { stdout } = await temporary(image.data, "png", (path) =>
      execute(
        "tesseract",
        [
          path,
          "stdout",
          "-l",
          "chi_tra+eng",
          "--psm",
          "11",
          "-c",
          "tessedit_create_tsv=1",
        ],
        { timeout: 40000, maxBuffer: 1500000 },
      ),
    );
    const words: Word[] = [];
    const lines = new Map<string, string[]>();
    for (const row of stdout.split("\n").slice(1)) {
      const columns = row.split("\t");
      if (columns[0] !== "5" || !columns[11]?.trim()) continue;
      const [x, y, width, height, confidence] = columns
        .slice(6, 11)
        .map(Number);
      const text = columns.slice(11).join(" ").trim();
      words.push({ text, confidence, x, y, width, height });
      const key = columns.slice(1, 5).join("-");
      const line = lines.get(key) ?? [];
      line.push(text);
      lines.set(key, line);
    }
    if (!words.length) throw new FeatureError("noText");
    return {
      words,
      text: [...lines.values()].map((line) => line.join(" ")).join("\n"),
      width: image.info.width,
      height: image.info.height,
      image: "data:image/png;base64," + image.data.toString("base64"),
    };
  } catch (error) {
    if (error instanceof FeatureError) throw error;
    throw new FeatureError("ocrFailure");
  }
}
export async function parseFile(buffer: Buffer, ext: string) {
  if (ext === "txt") return [{ section: "1", text: buffer.toString("utf8") }];
  if (ext === "docx") {
    if (buffer.length < 22) throw new FeatureError("fileType");
    let end = -1;
    for (
      let i = buffer.length - 22;
      i >= Math.max(0, buffer.length - 65557);
      i--
    )
      if (buffer.readUInt32LE(i) === 0x06054b50) {
        end = i;
        break;
      }
    if (end < 0) throw new FeatureError("fileType");
    const entries = buffer.readUInt16LE(end + 10);
    let offset = buffer.readUInt32LE(end + 16),
      expanded = 0;
    if (entries > 300 || !entries) throw new FeatureError("fileSize");
    for (let index = 0; index < entries; index++) {
      if (
        offset + 46 > buffer.length ||
        buffer.readUInt32LE(offset) !== 0x02014b50
      )
        throw new FeatureError("fileType");
      expanded += buffer.readUInt32LE(offset + 24);
      if (expanded > 24000000) throw new FeatureError("fileSize");
      offset +=
        46 +
        buffer.readUInt16LE(offset + 28) +
        buffer.readUInt16LE(offset + 30) +
        buffer.readUInt16LE(offset + 32);
    }
    const { value } = await mammoth.extractRawText({ buffer });
    return value
      .split(/\n\s*\n/)
      .map((text, index) => ({ section: String(index + 1), text }));
  }
  if (ext === "pdf") {
    const { stdout } = await temporary(buffer, ext, (path) =>
      execute("pdftotext", ["-layout", "-l", "100", path, "-"], {
        timeout: 20000,
        maxBuffer: 1500000,
      }),
    );
    return stdout
      .split("\f")
      .map((text, index) => ({ section: String(index + 1), text }));
  }
  return [{ section: "1", text: (await ocr(buffer)).text }];
}
