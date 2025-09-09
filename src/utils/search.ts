export const ES_COLLATION = {
  locale: "es",
  strength: 1,
  caseLevel: false,
} as const;

export function toTokens(q = "") {
  return [
    ...new Set(
      q
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter(Boolean)
    ),
  ];
}

export function parseCadena(cadena?: string) {
  if (!cadena) return {};
  const clean = cadena.replace(/[^a-zA-Z0-9]/g, "");
  const fam = clean.match(/^[A-Za-z]+/)?.[0] ?? "";
  const rest = clean.slice(fam.length);
  let grupo = "",
    subgrupo = "";
  if (rest.length >= 2) {
    grupo = rest.slice(0, rest.length - 1);
    subgrupo = rest.slice(-1);
  } else if (rest.length === 1) {
    grupo = rest;
  }
  return { CodFami: fam.toUpperCase(), CodGrupo: grupo, CodSubgrupo: subgrupo };
}

export function parseBoolish(v?: string) {
  if (v == null) return undefined;
  const s = String(v).toLowerCase();
  if (["s", "si", "sí", "true", "1"].includes(s)) return "S";
  if (["n", "no", "false", "0"].includes(s)) return "N";
  return undefined;
}

function singularPluralVariants(tok: string) {
  const set = new Set<string>([tok]);
  if (tok.endsWith("es")) set.add(tok.slice(0, -2));
  if (tok.endsWith("s")) set.add(tok.slice(0, -1));
  set.add(tok + "s");
  set.add(tok + "es");
  return [...set];
}

export async function expandWithSynonyms(
  tokens: string[],
  SynonymModel: any
): Promise<string[]> {
  if (!tokens.length) return [];
  const rows = await SynonymModel.find({ term: { $in: tokens } }).lean();
  const map = new Map<string, string[]>();
  rows.forEach((r: any) => map.set(r.term, r.synonyms || []));
  const expanded = new Set<string>();
  tokens.forEach((t) => {
    singularPluralVariants(t).forEach((v) => expanded.add(v));
    (map.get(t) || []).forEach((s) =>
      singularPluralVariants(s).forEach((v) => expanded.add(v))
    );
  });
  return [...expanded];
}

export function buildOrRegex(fields: string[], terms: string[]) {
  const ors = terms.map(
    (t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
  );
  return {
    $or: fields.flatMap((f) => ors.map((r) => ({ [f]: { $regex: r } }))),
  };
}
