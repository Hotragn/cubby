// Rule packs. Each number below comes from the state's published regulation; the
// citation travels with every flag so the provider can check it. Checked 2026-10-18.

const MA_BASE = "https://www.law.cornell.edu/regulations/massachusetts/606-CMR-7-";

export const PACKS = {
  MA: {
    code: "MA",
    name: "Massachusetts · 606 CMR 7.00 (EEC)",
    short: "MA 606 CMR 7.00",
    defaults: { open: "7:00", close: "17:30" },
    // 7.10(4)(d),(f)-(h): one educator up to 6 children with at most 3 under age 2;
    // two educators up to 10 with at most 6 under 2, at most 3 of them infants (under 15 months, 7.02);
    // three educators up to 10 with at most 6 infants. 7.10(4)(e) (7–8 children with school-agers) isn't modeled.
    ratio: {
      graceMin: 1,
      byAdults: [
        null,
        { total: 6, under: [{ months: 24, max: 3 }] },
        { total: 10, under: [{ months: 24, max: 6 }, { months: 15, max: 3 }] },
        { total: 10, under: [{ months: 15, max: 6 }] },
      ],
    },
    // 7.10(7)(d): napping children visually checked at least every 15 minutes.
    sleep: { everyMin: 15, infantMonths: 15, infantEveryMin: 15 },
    cites: {
      ratio: { sec: "606 CMR 7.10(4)(d)–(h)", text: "One educator: up to 6 children, at most 3 under age 2. Two educators: up to 10, at most 6 under 2 and 3 infants.", url: MA_BASE + "10" },
      sleep: { sec: "606 CMR 7.10(7)(d)", text: "Napping children must be visually checked at least every 15 minutes.", url: MA_BASE + "10" },
      med: { sec: "606 CMR 7.11(2)(j), (l)", text: "Log every dose: medicine, dose, time, method and who gave it. Written parent consent; oral non-prescription consent is renewed weekly.", url: MA_BASE + "11" },
      incident: { sec: "606 CMR 7.08(8), 7.11(5)(f)", text: "Keep a record of injuries and incidents. Tell parents in writing within 24 hours (immediately if care beyond minor first aid).", url: MA_BASE + "08" },
      attendance: { sec: "606 CMR 7.04(4)", text: "Daily attendance with each child's arrival and departure times, dated and signed. Keep 5 years.", url: MA_BASE + "04" },
      records: { sec: "606 CMR 7.04(4)", text: "Records must be accurate, legible and dated.", url: MA_BASE + "04" },
      release: { sec: "Your pickup policy", text: "Massachusetts requires written parent authorization for who may take a child when you transport (7.13(6)(h)); Cubby applies your pickup list at the door too.", url: MA_BASE + "13" },
      allergy: { sec: "Your allergy list", text: "Allergies come from each child's record in Setup. Cubby flags any logged food that names one.", url: MA_BASE + "04" },
      late: { sec: "Your late-pickup policy (7.08(6)(g))", text: "MA asks that your fee policy state any late-pickup fee. Cubby flags pickups after your closing time.", url: MA_BASE + "08" },
    },
  },
};

// A provider's own settings layered over the state pack. Anything looser than the
// state's rule is still allowed (it's their program) but setup shows a warning.
export const AGE_GROUPS = { infant: { label: "Infant (under 15 months)", months: 9 }, young_toddler: { label: "Toddler, 15–23 months", months: 19 }, toddler: { label: "Toddler, 2 years", months: 30 }, preschool: { label: "Preschool, 3–5 years", months: 48 }, school: { label: "School age", months: 84 } };

export function makePack(program) {
  const base = PACKS[program?.state ?? "MA"] ?? PACKS.MA;
  const s = program?.settings ?? {};
  const pack = structuredClone(base);
  if (s.open) pack.defaults.open = s.open;
  if (s.close) pack.defaults.close = s.close;
  if (s.sleepEvery) { pack.sleep.everyMin = +s.sleepEvery; }
  if (s.infantSleepEvery) pack.sleep.infantEveryMin = +s.infantSleepEvery;
  if (s.ratio?.byAdults) pack.ratio.byAdults = s.ratio.byAdults;
  return pack;
}

export function looserThanState(program) {
  const base = PACKS[program?.state ?? "MA"] ?? PACKS.MA, s = program?.settings ?? {}, out = [];
  if (s.sleepEvery && +s.sleepEvery > base.sleep.everyMin) out.push(`Sleep checks every ${s.sleepEvery} min is longer than ${base.short}'s ${base.sleep.everyMin} min (${base.cites.sleep.sec}).`);
  if (s.infantSleepEvery && +s.infantSleepEvery > base.sleep.infantEveryMin) out.push(`Infant checks every ${s.infantSleepEvery} min is longer than the state's ${base.sleep.infantEveryMin} min.`);
  (s.ratio?.byAdults ?? []).forEach((row, i) => { const b = base.ratio.byAdults[i]; if (!row || !b) return;
    if (row.total > b.total) out.push(`${i} adult${i > 1 ? "s" : ""}: ${row.total} children is above the state's ${b.total} (${base.cites.ratio.sec}).`);
    (row.under ?? []).forEach((u, j) => { const bu = b.under?.find((x) => x.months === u.months); if (bu && u.max > bu.max) out.push(`${i} adult${i > 1 ? "s" : ""}: ${u.max} under ${u.months} months is above the state's ${bu.max}.`); }); });
  return out;
}
