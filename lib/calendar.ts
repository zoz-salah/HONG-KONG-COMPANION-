export function calendar(title: string, iso: string) {
  const escape = (v: string) =>
    v
      .replaceAll("\\", "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");
  const stamp = (v: string) => v.replace(/[-:]/g, "").replace(/\.\d+Z/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hong Kong Companion//Reminders//EN",
    "BEGIN:VEVENT",
    "UID:" + globalThis.crypto.randomUUID() + "@hong-kong-companion",
    "DTSTAMP:" + stamp(new Date().toISOString()),
    "DTSTART:" + stamp(iso),
    "SUMMARY:" + escape(title),
    "BEGIN:VALARM",
    "TRIGGER:PT0M",
    "ACTION:DISPLAY",
    "DESCRIPTION:" + escape(title),
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return (
    lines
      .map((line) => {
        let folded = "",
          bytes = 0;
        const encoder = new TextEncoder();
        for (const char of line) {
          const size = encoder.encode(char).length;
          if (bytes + size > 75) {
            folded += "\r\n ";
            bytes = 1;
          }
          folded += char;
          bytes += size;
        }
        return folded;
      })
      .join("\r\n") + "\r\n"
  );
}
