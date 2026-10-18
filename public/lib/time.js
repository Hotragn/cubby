// Times are minutes after midnight. Plain code, no model.

export function toMin(s) {
  if (s == null || s === "") return null;
  if (typeof s === "number") return s;
  // Speech-to-text writes "1:10" as "110" and "12:45" as "1245".
  const bare = String(s).trim().toLowerCase().match(/^(\d{1,2})(\d{2})\s*(a\.?m\.?|p\.?m\.?)?$/);
  if (bare && +bare[2] < 60) s = `${bare[1]}:${bare[2]}${bare[3] ? " " + bare[3] : ""}`;
  const m = String(s).trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  if (h > 23 || min > 59) return null;
  if (m[3]?.startsWith("p") && h < 12) h += 12;
  if (m[3]?.startsWith("a") && h === 12) h = 0;
  return h * 60 + min;
}

// 24h → "1:10 pm"
export function fmt(min) {
  if (min == null) return "—";
  const h = Math.floor(min / 60), m = min % 60;
  const ap = h >= 12 ? "pm" : "am";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

export function hhmm(min) {
  if (min == null) return "";
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function dur(mins) {
  if (mins == null || mins < 0) return "—";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? (m ? `${h} hr ${m} min` : `${h} hr`) : `${m} min`;
}

// Providers write "1:10" meaning 1:10 pm. A clock time from 1:00 to 5:59 with no am/pm
// and no leading zero is read as pm (a daycare day runs about 6 am – 7 pm). Anything else stays as written.
export function dayTime(s) {
  if (s == null) return null;
  if (typeof s === "number") return s;
  const raw = String(s).trim().toLowerCase();
  const v = toMin(raw);
  if (v == null) return null;
  // "06:59" (leading zero) is a 24-hour clock time and stays as written.
  if (!/[ap]\.?m/.test(raw) && !/^0\d/.test(raw) && v >= 60 && v < 6 * 60) return v + 12 * 60;
  return v;
}
