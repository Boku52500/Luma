import {
  AirVent,
  CookingPot,
  Cpu,
  Gamepad2,
  Headphones,
  House,
  Keyboard,
  Laptop,
  Lightbulb,
  Monitor,
  Mouse,
  Percent,
  Printer,
  Smartphone,
  Sparkles,
  Tablet,
  Tag,
  Tv,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { createElement } from "react";
import { isCategoryIconKey, type CategoryIconKey } from "@/lib/categoryMainTaxonomy";

const iconKeyIcons: Record<CategoryIconKey, LucideIcon> = {
  monitor: Monitor,
  keyboard: Keyboard,
  smartphone: Smartphone,
  tv: Tv,
  headphones: Headphones,
  gamepad: Gamepad2,
  wifi: Wifi,
  "air-vent": AirVent,
  "cooking-pot": CookingPot,
  home: House,
  sparkles: Sparkles,
  printer: Printer,
};

const slugIcons: Record<string, LucideIcon> = {
  phones: Smartphone,
  "phones-smartphones": Smartphone,
  "phones-apple": Smartphone,
  "phones-and-tablets": Smartphone,
  laptops: Laptop,
  tablets: Tablet,
  tv: Tv,
  televisions: Tv,
  "tv-photo-video": Tv,
  monitors: Monitor,
  "computers-and-components": Monitor,
  components: Cpu,
  gaming: Gamepad2,
  accessories: Mouse,
  "computer-accessories": Keyboard,
  audio: Headphones,
  "smart-home": Lightbulb,
  network: Wifi,
  "network-and-connectivity": Wifi,
  "climate-appliances": AirVent,
  "kitchen-appliances": CookingPot,
  "home-appliances": House,
  "beauty-and-care": Sparkles,
  "office-equipment": Printer,
  deals: Percent,
  new: Tag,
};

export const CATEGORY_ICON_OPTIONS: Array<{ key: CategoryIconKey; label: string }> = [
  { key: "monitor", label: "მონიტორი / კომპიუტერი" },
  { key: "keyboard", label: "კლავიატურა" },
  { key: "smartphone", label: "სმარტფონი" },
  { key: "tv", label: "ტელევიზორი" },
  { key: "headphones", label: "ყურსასმენები" },
  { key: "gamepad", label: "გეიმპადი" },
  { key: "wifi", label: "Wi‑Fi / ქსელი" },
  { key: "air-vent", label: "კლიმატი" },
  { key: "cooking-pot", label: "სამზარეულო" },
  { key: "home", label: "სახლი" },
  { key: "sparkles", label: "სილამაზე" },
  { key: "printer", label: "პრინტერი" },
];

export function categoryIconForKey(iconKey: string | null | undefined): LucideIcon | null {
  if (!iconKey || !isCategoryIconKey(iconKey)) return null;
  return iconKeyIcons[iconKey];
}

export function categoryIconForSlug(slug: string, iconKey?: string | null): LucideIcon {
  const byKey = categoryIconForKey(iconKey);
  if (byKey) return byKey;
  if (slugIcons[slug]) return slugIcons[slug];
  const prefix = slug.split("-")[0];
  if (prefix && slugIcons[prefix]) return slugIcons[prefix];
  return Tag;
}

export function CategoryIcon({
  slug,
  iconKey,
  className,
  strokeWidth = 1.75,
}: {
  slug: string;
  iconKey?: string | null;
  className?: string;
  strokeWidth?: number;
}) {
  return createElement(categoryIconForSlug(slug, iconKey), { className, strokeWidth });
}
