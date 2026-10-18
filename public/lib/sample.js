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

// Four earlier fictional days for the week view (days before the demo day).
export const DEMO_WEEK = [
  { back: 4, notes: [
    ["07:25", "Rosa in"], ["07:35", "Ava here w mom"], ["07:44", "Leo in, dad dropped"], ["07:58", "Mila arrived with Hana"], ["08:02", "Dana in"], ["08:12", "Theo here w dad"],
    ["08:45", "breakfast cheerios and banana, Leo all, Ava most, Theo half. Mila 5 oz bottle"], ["09:40", "Mila down 9:40"], ["09:55", "checked Mila 9:55"], ["10:10", "checked Mila 10:10 on back"], ["10:22", "Mila up 10:20"],
    ["11:40", "lunch chicken and rice, all ate most"], ["12:30", "Mila Theo Ava Leo down for nap 12:30"], ["12:45", "checked all 12:45"], ["13:00", "checked all 1:00"], ["13:15", "checked all 1:15 on backs"], ["13:30", "checked all 1:30"], ["13:45", "checked all 1:45"], ["14:00", "checked all 2:00"], ["14:16", "everyone up 2:15"],
    ["15:00", "snack crackers and cheese, all ate most"], ["16:10", "Mila picked up by Hana"], ["16:30", "Leo picked up by Sami"], ["16:50", "Theo home with dad"], ["17:10", "Ava picked up by mom"], ["17:15", "Dana out"],
  ] },
  { back: 3, notes: [
    ["07:20", "Rosa in"], ["07:31", "Ava here mom"], ["07:50", "Mila in w Hana"], ["08:05", "Theo here w mom"], ["08:30", "Dana in"],
    ["08:50", "breakfast oatmeal, Ava all, Theo most. Mila bottle 6 oz"], ["10:05", "Theo tripped on the rug and bumped his lip, cold cloth, Dana saw"],
    ["11:45", "lunch pasta and peas, Ava half, Theo all, Mila sweet potato puree all"], ["12:40", "Mila Theo Ava down 12:40"], ["12:55", "checked all 12:55"], ["13:10", "checked all 1:10"], ["13:25", "checked all 1:25, all asleep"], ["13:40", "checked all 1:40"], ["13:55", "checked all 1:55"], ["14:06", "all up 2:05"],
    ["15:05", "snack apples, all ate some"], ["16:20", "Mila picked up by Hana"], ["16:55", "Theo home w mom"], ["17:20", "Ava picked up by mom"], ["17:25", "Dana out"],
  ] },
  { back: 2, notes: [
    ["07:22", "Rosa in"], ["07:30", "Leo in w dad"], ["07:38", "Ava here w mom"], ["07:55", "Mila arrived Hana"], ["08:10", "Theo w dad"], ["08:15", "Dana in"],
    ["08:40", "breakfast toast and eggs, Leo most, Ava all, Theo little. Mila 5 oz"], ["10:00", "Gave Leo 2.5 ml Tylenol at 10, teething, Rosa"],
    ["11:45", "lunch fish sticks and corn, all ate most"], ["12:35", "Mila Theo Ava Leo down 12:35"], ["12:50", "checked all 12:50"], ["13:05", "checked all 1:05"], ["13:35", "checked all 1:35"], ["13:50", "checked all 1:50"], ["14:05", "checked all 2:05"], ["14:21", "everyone up 2:20"],
    ["15:00", "snack goldfish, all ate most"], ["16:05", "Mila picked up by Hana"], ["16:35", "Leo picked up by Rania"], ["17:00", "Theo home w dad"], ["17:40", "Ava picked up 5:40 by mom"], ["17:42", "Dana out"],
  ] },
  { back: 1, notes: [
    ["07:24", "Rosa in"], ["07:33", "Ava in w mom"], ["07:41", "Leo here w dad"], ["07:52", "Mila here with Hana"], ["08:05", "Dana in"], ["08:09", "Theo in w dad"],
    ["08:40", "breakfast yogurt and berries, all ate all. Mila 5 oz bottle"], ["09:45", "Mila down 9:45"], ["10:00", "Mila check 10:00"], ["10:15", "Mila check 10:15"], ["10:31", "Mila up 10:30"],
    ["11:45", "lunch turkey wraps, Leo all, Ava most, Theo most, Mila puree half"], ["12:30", "Mila Theo Ava Leo down 12:30"], ["12:45", "checked all 12:45"], ["13:00", "checked all 1:00"], ["13:15", "checked all 1:15"], ["13:30", "checked all 1:30"], ["13:45", "checked all 1:45"], ["14:00", "checked all 2:00"], ["14:11", "all up 2:10"],
    ["15:00", "snack pears, all ate all"], ["16:15", "Mila picked up by Hana"], ["16:40", "Leo home with Sami"], ["17:00", "Theo picked up by dad"], ["17:15", "Ava picked up by mom"], ["17:20", "Dana out"],
  ] },
];
