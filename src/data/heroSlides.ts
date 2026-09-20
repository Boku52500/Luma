import type { ProductVisual } from "@/types/product";

export interface HeroSlide {
  id: string;
  brand: string;
  title: string;
  description: string;
  ribbon?: string;
  href: string;
  visual: ProductVisual;
  /** Full-bleed slide background — a Tailwind background class from the design system. */
  bg: string;
}

/** Promotional carousel slides shown in the homepage hero. */
export const heroSlides: HeroSlide[] = [
  {
    id: "slide-brand",
    brand: "LUMA",
    title: "სანდო ტექნიკის მაღაზია",
    description: "ორიგინალი პროდუქცია და ოფიციალური გარანტია",
    href: "/category/phones",
    visual: "phone",
    bg: "bg-ink-900",
  },
  {
    id: "slide-iphone",
    brand: "APPLE",
    title: "iPhone 15 სერია",
    description: "წინასწარი შეკვეთით −10%",
    ribbon: "-10%",
    href: "/category/phones",
    visual: "phone",
    bg: "bg-brand-600",
  },
  {
    id: "slide-gaming",
    brand: "ASUS · LENOVO",
    title: "გეიმინგ ლეპტოპები",
    description: "RTX სერიის მოდელები საუკეთესო ფასად",
    ribbon: "ახალი",
    href: "/category/gaming",
    visual: "gaming",
    bg: "bg-brand-900",
  },
  {
    id: "slide-audio",
    brand: "SONY · JBL",
    title: "აუდიო კოლექცია",
    description: "საუკეთესო ხმა სახლისთვის და გზისთვის",
    href: "/category/audio",
    visual: "audio",
    bg: "bg-accent-600",
  },
];
