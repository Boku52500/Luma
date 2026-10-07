import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { isPublicImageUrl } from "@/lib/productImageLimits";
import { logError } from "@/server/log";

export const dynamic = "force-dynamic";

const MAX_IDS = 40;

/**
 * Resolve primary product images for legacy cart lines that only stored
 * visual/tone placeholders. Public catalogue data only.
 */
export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get("ids") ?? "";
    const ids = [
      ...new Set(
        raw
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ].slice(0, MAX_IDS);

    if (ids.length === 0) {
      return Response.json(
        { images: {} as Record<string, { src: string; alt: string }> },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const products = await prisma.product.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        translations: { select: { locale: true, name: true } },
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: {
            url: true,
            translations: { select: { locale: true, alt: true } },
          },
        },
      },
    });

    const images: Record<string, { src: string; alt: string }> = {};
    for (const product of products) {
      const image = product.images[0];
      if (!image || !isPublicImageUrl(image.url)) continue;
      const kaName = product.translations.find((row) => row.locale === "ka")?.name;
      const name = kaName || product.translations[0]?.name || "პროდუქტი";
      const kaAlt = image.translations.find((row) => row.locale === "ka")?.alt;
      const alt = (kaAlt || image.translations[0]?.alt || name).trim() || name;
      images[product.id] = { src: image.url, alt };
    }

    return Response.json(
      { images },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (error) {
    logError("api.cart_product_images_failed", { error });
    return Response.json(
      { images: {} as Record<string, { src: string; alt: string }> },
      { status: 200, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
