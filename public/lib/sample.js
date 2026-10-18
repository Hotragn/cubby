// A fictional day at a fictional home daycare. Every name here is invented.
// The planted problems are listed in PLANTED so the demo and the tests agree on them.

export const SAMPLE_NOTES = [
  ["07:28", "Rosa in."],
  ["07:31", "Ava here, mom dropped her off. Bit sleepy"],
  ["07:40", "Leo in with his dad"],
  ["07:52", "Mila arrived, Hana dropped off"],
  ["08:05", "Dana in"],
  ["08:10", "Theo here w dad"],
  ["08:40", "breakfast oatmeal and bananas. Leo ate all of it, Ava half, Theo most. Mila 5 oz bottle"],
  ["09:15", "Mila and Theo wet diapers. Leo tried the potty, pee!"],
  ["09:30", "Ava pooped, changed"],
  ["09:45", "Mila down for morning nap 9:45"],
  ["10:00", "checked Mila 10:00 on her back"],
  ["10:15", "checked Mila, on back sleeping"],
  ["10:20", "Theo bumped his forehead on the train table, small red mark, ice pack 5 min. Dana saw it"],
  ["10:26", "Mila up 10:25 happy"],
  ["10:40", "Playdough at the table, Ava and Leo loved it. Theo walked laps around the couch"],
  ["11:02", "the baby had a 4 oz bottle"],
  ["11:30", "Gave Leo 2.5 ml Tylenol for teething at 11:30 - Rosa"],
  ["11:45", "Lunch mac and cheese and peas. Ava and Leo ate all, Theo picked at it, Mila carrot puree half"],
  ["12:20", "Mila down for nap 12:20"],
  ["12:35", "Mila check 12:35, back"],
  ["12:50", "Mila check ok 12:50"],
  ["12:56", "Theo down for nap 12:55"],
  ["13:25", "sleep check all kids 1:25, everyone on their backs"],
  ["13:40", "checked all 1:40"],
  ["13:55", "check 1:55 all asleep"],
  ["14:06", "Mila awake 2:05, wet diaper"],
  ["14:10", "checked Theo Ava Leo 2:10"],
  ["14:21", "Theo up at 2:20"],
  ["14:25", "checked Ava and Leo 2:25"],
  ["14:42", "Ava and Leo napped 1:10 to 2:40"],
  ["14:45", "Dana out for school run"],
  ["15:00", "snack apple slices and crackers, all kids ate most"],
  ["15:15", "Mila picked up by Hana"],
  ["15:30", "Dana back"],
  ["16:00", "Ava bit Leo on the arm over a truck, no mark, talked to both"],
  ["16:20", "Leo in a great mood today, so chatty"],
  ["16:40", "Leo picked up by Sami"],
  ["17:05", "Theo went home with his grandma Ingrid"],
  ["17:52", "Ava picked up 5:50 by mom, she was stuck in traffic"],
];

const shift = (iso, days) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const dob = (iso, months) => { const d = new Date(iso + "T12:00:00"); d.setMonth(d.getMonth() - months); d.setDate(d.getDate() - 5); return d.toISOString().slice(0, 10); };

export function sampleRoster(date) {
  return [
    { id: "mila", name: "Mila", full: "Mila Novak", dob: dob(date, 9), color: "#FF6B4A", lang: "English", pickup: [{ name: "Hana Novak", rel: "mom" }], consents: [{ med: "Diaper cream", dose: "thin layer", signed: shift(date, -30), until: shift(date, 60) }] },
    { id: "theo", name: "Theo", full: "Theo Brandt", dob: dob(date, 15), color: "#2F7BFF", lang: "English", pickup: [{ name: "Jonas Brandt", rel: "dad" }, { name: "Lea Brandt", rel: "mom" }], consents: [] },
    { id: "ava", name: "Ava", full: "Ava Reyes", dob: dob(date, 20), color: "#00A87E", lang: "Spanish", pickup: [{ name: "Carmen Reyes", rel: "mom" }], consents: [] },
    // Oral non-prescription consent in MA is renewed weekly (606 CMR 7.11(2)(l)); this one lapsed.
    { id: "leo", name: "Leo", full: "Leo Haddad", dob: dob(date, 23), color: "#8B5CF6", lang: "Arabic", pickup: [{ name: "Sami Haddad", rel: "dad" }, { name: "Rania Haddad", rel: "mom" }], consents: [{ med: "Tylenol", dose: "2.5 ml", signed: shift(date, -10), until: shift(date, -3) }] },
  ];
}

export const SAMPLE_STAFF = [
  { id: "rosa", name: "Rosa", full: "Rosa Medina", role: "Licensed provider" },
  { id: "dana", name: "Dana", full: "Dana Okafor", role: "Assistant" },
];

export const PLANTED = [
  { rule: "sleep", kid: "mila", what: "Mila's nap 12:20–2:05 has a 35 min gap between checks (12:50 → 1:25)" },
  { rule: "sleep", kid: "theo", what: "Theo's nap 12:55–2:20: first check at 1:25, 30 min after he went down" },
  { rule: "incident", kid: "theo", what: "Theo bumped his forehead, no incident report" },
  { rule: "incident", kid: "leo", what: "Leo was bitten, no incident report" },
  { rule: "med", kid: "leo", what: "Leo's Tylenol consent expired 3 days ago (weekly renewal)" },
  { rule: "ratio", kid: null, what: "2:45–3:15 pm: 4 children under 2 with one adult (limit 3)" },
  { rule: "attendance", kid: "theo", what: "Theo went home with Ingrid, who isn't on the pickup list" },
  { rule: "late", kid: "ava", what: "Ava picked up 5:50 pm, after 5:30 close" },
  { rule: "question", kid: null, what: "\"the baby\" — which child?" },
];
