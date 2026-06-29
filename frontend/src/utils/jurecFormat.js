const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function ordinalDay(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  const mod = n % 10;
  if (mod === 1) return `${n}st`;
  if (mod === 2) return `${n}nd`;
  if (mod === 3) return `${n}rd`;
  return `${n}th`;
}

export function formatJurecDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${ordinalDay(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
