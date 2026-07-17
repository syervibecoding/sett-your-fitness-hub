export const MASTER_COMPANY_STORAGE_KEY = "master_viewing_company";

export interface ViewingCompany {
  id: string;
  name: string;
  tier: string;
  slug: string | null;
}

type CompanyCandidate = Partial<ViewingCompany> & Pick<ViewingCompany, "id" | "name">;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeViewingCompany(company: CompanyCandidate): ViewingCompany | null {
  if (!isNonEmptyString(company.id) || !UUID_PATTERN.test(company.id) || !isNonEmptyString(company.name)) {
    return null;
  }

  return {
    id: company.id,
    name: company.name,
    tier: isNonEmptyString(company.tier) ? company.tier : "basic",
    slug: isNonEmptyString(company.slug) ? company.slug : null,
  };
}

export function parseStoredViewingCompany(raw: string | null): ViewingCompany | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CompanyCandidate;
    return normalizeViewingCompany(parsed);
  } catch {
    return null;
  }
}

export function resolveViewingCompany(
  stored: ViewingCompany,
  candidates: CompanyCandidate[],
): ViewingCompany | null {
  const normalized = candidates
    .map(normalizeViewingCompany)
    .filter((company): company is ViewingCompany => company !== null);

  const exactId = normalized.find((company) => company.id === stored.id);
  if (exactId) return exactId;

  if (stored.slug) {
    const slugMatches = normalized.filter((company) => company.slug === stored.slug);
    if (slugMatches.length === 1) return slugMatches[0];
  }

  const normalizedName = stored.name.trim().toLocaleLowerCase("pt-BR");
  const nameMatches = normalized.filter(
    (company) => company.name.trim().toLocaleLowerCase("pt-BR") === normalizedName,
  );

  return nameMatches.length === 1 ? nameMatches[0] : null;
}
