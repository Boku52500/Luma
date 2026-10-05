import { reusableIdentityKey } from "@/lib/reusableLabel";
import { categorySlugFromName } from "@/lib/categorySlug";

/** Lucide-oriented icon keys stored on Category.iconKey for main categories. */
export const CATEGORY_ICON_KEYS = [
  "monitor",
  "keyboard",
  "smartphone",
  "tv",
  "headphones",
  "gamepad",
  "wifi",
  "air-vent",
  "cooking-pot",
  "home",
  "sparkles",
  "printer",
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

export type MainCategoryChildPlan = {
  /** Canonical display / match name */
  name: string;
  /** Extra KA (or Latin) names that should match the same existing category */
  aliases?: string[];
};

export type MainCategoryPlan = {
  name: string;
  /** Stable preferred slug for find-or-create */
  slug: string;
  iconKey: CategoryIconKey;
  children: MainCategoryChildPlan[];
};

/**
 * Target Admin Categories taxonomy. Existing leaf categories are reparented;
 * mains are created only when missing (matched by slug or KA name).
 */
export const MAIN_CATEGORY_TAXONOMY: MainCategoryPlan[] = [
  {
    name: "კომპიუტერები და კომპონენტები",
    slug: "computers-and-components",
    iconKey: "monitor",
    children: [
      { name: "პანელური კომპიუტერი | All-In-One", aliases: ["პანელური კომპიუტერი", "All-In-One", "All In One", "AIO"] },
      { name: "ქეისები", aliases: ["ქეისი"] },
      { name: "პროცესორი", aliases: ["პროცესორები", "CPU"] },
      { name: "ქულერი", aliases: ["ქულერები"] },
      { name: "მეხსიერება SSD/HDD", aliases: ["მეხსიერება", "SSD", "HDD", "SSD/HDD"] },
      { name: "დედაპლატა", aliases: ["დედაპლატები", "Motherboard"] },
      { name: "კვების ბლოკი", aliases: ["კვების ბლოკები", "PSU"] },
      { name: "ვიდეო ბარათი / ვიდეო კარტა", aliases: ["ვიდეო ბარათი", "ვიდეო კარტა", "ვიდეობარათი", "GPU"] },
      { name: "ლეპტოპები", aliases: ["ლეპტოპი"] },
      { name: "მონიტორები", aliases: ["მონიტორი"] },
    ],
  },
  {
    name: "კომპიუტერის აქსესუარები",
    slug: "computer-accessories",
    iconKey: "keyboard",
    children: [
      { name: "კომპიუტერის ყურსასმენები" },
      { name: "კლავიატურა", aliases: ["კლავიატურები"] },
      { name: "კომპიუტერის მიკროფონი", aliases: ["მიკროფონი"] },
      { name: "მაუსები", aliases: ["მაუსი"] },
    ],
  },
  {
    name: "ტელეფონები და პლანშეტები",
    slug: "phones-and-tablets",
    iconKey: "smartphone",
    children: [
      { name: "ტელეფონები", aliases: ["ტელეფონი", "სმარტფონები", "სმარტფონი"] },
      { name: "პლანშეტები", aliases: ["პლანშეტი", "ტაბლეტები", "ტაბლეტი"] },
    ],
  },
  {
    name: "TV, ფოტო და ვიდეო",
    slug: "tv-photo-video",
    iconKey: "tv",
    children: [
      { name: "ტელევიზორები", aliases: ["ტელევიზორი", "TV"] },
      { name: "კამერები", aliases: ["კამერა"] },
      { name: "პროექტორი", aliases: ["პროექტორები"] },
    ],
  },
  {
    name: "აუდიო",
    slug: "audio",
    iconKey: "headphones",
    children: [
      { name: "ყურსასმენები", aliases: ["ყურსასმენი"] },
      { name: "პორტატული დინამიკი", aliases: ["პორტატული დინამიკები", "დინამიკი"] },
    ],
  },
  {
    name: "გეიმინგი",
    slug: "gaming",
    iconKey: "gamepad",
    children: [{ name: "სათამაშო კონსოლები", aliases: ["სათამაშო კონსოლი", "კონსოლები", "კონსოლი"] }],
  },
  {
    name: "ქსელი და კავშირი",
    slug: "network-and-connectivity",
    iconKey: "wifi",
    children: [
      { name: "როუტერები", aliases: ["როუტერი", "ქსელური მოწყობილობები"] },
    ],
  },
  {
    name: "კლიმატური ტექნიკა",
    slug: "climate-appliances",
    iconKey: "air-vent",
    children: [{ name: "კონდინციონერი", aliases: ["კონდიციონერი", "კონდიციონერები"] }],
  },
  {
    name: "სამზარეულოს ტექნიკა",
    slug: "kitchen-appliances",
    iconKey: "cooking-pot",
    children: [
      { name: "ბლენდერი", aliases: ["ბლენდერები"] },
      { name: "აერო გრილი", aliases: ["აეროგრილი"] },
      { name: "წვენსაწური", aliases: ["წვენსაწურები"] },
      { name: "გრილი", aliases: ["გრილები"] },
      { name: "ყავის აპარატი", aliases: ["ყავის აპარატები"] },
      { name: "ჩაიდანი", aliases: ["ჩაიდანები"] },
      { name: "სამზარეულოს კომბაინი", aliases: ["კომბაინი"] },
      { name: "ხორცის მანქანა", aliases: ["ხორცის მანქანები"] },
      { name: "სენვიჩ მეიქერი", aliases: ["სენდვიჩ მეიქერი", "სენვიჩმეიქერი"] },
      { name: "ტოსტერი", aliases: ["ტოსტერები"] },
      { name: "ვაფლის აპარატი", aliases: ["ვაფლის აპარატები"] },
    ],
  },
  {
    name: "სახლის ტექნიკა",
    slug: "home-appliances",
    iconKey: "home",
    children: [
      { name: "უთო", aliases: ["უთოები"] },
      { name: "მტვერსასრუტი", aliases: ["მტვერსასრუტები"] },
    ],
  },
  {
    name: "სილამაზე და მოვლა",
    slug: "beauty-and-care",
    iconKey: "sparkles",
    children: [
      { name: "თმის უთო" },
      { name: "თმის სახვევი" },
      { name: "წვერისა და თმის საპარსი", aliases: ["საპარსი"] },
    ],
  },
  {
    name: "საოფისე ტექნიკა",
    slug: "office-equipment",
    iconKey: "printer",
    children: [{ name: "პრინტერები", aliases: ["პრინტერი"] }],
  },
];

export function categoryMatchKey(name: string): string {
  return reusableIdentityKey(name);
}

export function childMatchKeys(child: MainCategoryChildPlan): string[] {
  const keys = new Set<string>();
  keys.add(categoryMatchKey(child.name));
  for (const alias of child.aliases ?? []) keys.add(categoryMatchKey(alias));
  // Also match the part before "|" for combined labels.
  const beforePipe = child.name.split("|")[0]?.trim();
  if (beforePipe) keys.add(categoryMatchKey(beforePipe));
  return [...keys].filter(Boolean);
}

export function mainCategorySlug(plan: MainCategoryPlan): string {
  return plan.slug || categorySlugFromName(plan.name);
}

export function isCategoryIconKey(value: string | null | undefined): value is CategoryIconKey {
  return Boolean(value && (CATEGORY_ICON_KEYS as readonly string[]).includes(value));
}
