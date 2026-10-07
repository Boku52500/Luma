import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/auth/admin";
import { prisma } from "@/server/db";
import { HOMEPAGE_SECTION_KEYS } from "@/lib/homepage/types";

/** Hero slides now live inside the homepage editor. Keep this path working as a redirect. */
export default async function AdminHeroRedirectPage() {
  await requireAdmin("/admin/hero");
  const heroSection = await prisma.homepageSection.findUnique({
    where: { key: HOMEPAGE_SECTION_KEYS.HERO },
    select: { id: true },
  });
  redirect(heroSection ? `/admin/homepage/${heroSection.id}` : "/admin/homepage");
}
