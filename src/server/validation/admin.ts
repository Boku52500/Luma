import { z } from "zod";
import { isValidMoneyInput } from "@/server/money";

const slug = z
  .string()
  .trim()
  .min(1, "შეიყვანეთ slug")
  .max(160, "Slug ძალიან გრძელია")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug უნდა იყოს lowercase kebab-case, მაგ: apple-iphone-15");

const optionalSlug = z
  .string()
  .trim()
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug უნდა იყოს lowercase kebab-case")
  .or(z.literal(""));

function moneyField(message: string) {
  return z
    .string()
    .trim()
    .min(1, message)
    .refine((value) => isValidMoneyInput(value), "შეიყვანეთ სწორი ფასი, მაგ: 1299 ან 1299.99");
}

function optionalMoneyField() {
  return z
    .string()
    .trim()
    .refine((value) => value === "" || isValidMoneyInput(value), "შეიყვანეთ სწორი ფასი, მაგ: 1299 ან 1299.99");
}

const optionalText = z.string().trim().max(20000).optional().nullable();

export const adminLocaleCopySchema = z.object({
  name: z.string().trim().max(200).optional().default(""),
  shortDescription: z.string().trim().max(800).optional().default(""),
  description: z.string().trim().max(20000).optional().default(""),
  seoTitle: z.string().trim().max(255).optional().default(""),
  seoDescription: z.string().trim().max(500).optional().default(""),
  warranty: z.string().trim().max(500).optional().default(""),
  deliveryEstimate: z.string().trim().max(200).optional().default(""),
});

export const adminProductImageSchema = z.object({
  id: z.string().trim().optional(),
  url: z.string().trim().min(1, "შეიყვანეთ სურათის URL").max(2000, "URL ძალიან გრძელია"),
  alt: z.string().trim().max(255).optional().default(""),
  sortOrder: z.number().int().min(0).max(999),
  objectKey: z.string().trim().max(500).optional().nullable(),
});

export const adminProductImageAltSchema = z.object({
  id: z.string().trim().min(1),
  alt: z.string().trim().max(255),
});

export const adminProductImageReorderSchema = z.object({
  productId: z.string().trim().min(1),
  orderedIds: z.array(z.string().trim().min(1)).min(1).max(80),
});

export const adminProductVariantSchema = z.object({
  id: z.string().trim().optional(),
  sku: z.string().trim().min(1, "შეიყვანეთ ვარიანტის SKU").max(64, "SKU ძალიან გრძელია"),
  priceOverride: optionalMoneyField(),
  stockQuantity: z.number().int().min(0).optional().default(0),
  isActive: z.boolean(),
  optionIds: z.array(z.string().trim().min(1)).default([]),
});

export const adminProductSpecSchema = z.object({
  specificationId: z.string().trim().min(1).optional().or(z.literal("")),
  specificationName: z.string().trim().max(120).optional().default(""),
  valueId: z.string().trim().max(64).optional().default(""),
  value: z.string().trim().max(500).optional().default(""),
});

export const adminProductSaveSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    sku: z.string().trim().min(1, "შეიყვანეთ SKU").max(64, "SKU ძალიან გრძელია"),
    slug,
    brandId: z.string().trim().min(1, "აირჩიეთ ბრენდი"),
    categoryId: z.string().trim().min(1, "აირჩიეთ კატეგორია"),
    price: moneyField("შეიყვანეთ ფასი"),
    previousPrice: optionalMoneyField(),
    stockQuantity: z.number().int().min(0).optional().default(0),
    stockStatus: z.enum(["in-stock", "low-stock", "out-of-stock"]).optional(),
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    isNew: z.boolean(),
    featuredSort: z.number().int().min(0).max(9999).nullable().optional(),
    newArrivalSort: z.number().int().min(0).max(9999).nullable().optional(),
    badgeKind: z.string().trim().max(40).nullable().optional(),
    badgeLabel: z.string().trim().max(80).nullable().optional(),
    indexable: z.boolean(),
    warrantyMonths: z.number().int().min(0).max(120).nullable().optional(),
    returnDays: z.number().int().min(0).max(365).nullable().optional(),
    translations: z.object({
      ka: adminLocaleCopySchema.extend({
        name: z.string().trim().min(1, "შეიყვანეთ ქართული დასახელება").max(200),
      }),
      en: adminLocaleCopySchema.optional(),
      ru: adminLocaleCopySchema.optional(),
    }),
    images: z.array(adminProductImageSchema).default([]),
    variants: z.array(adminProductVariantSchema).default([]),
    specifications: z.array(adminProductSpecSchema).default([]),
  })
  .refine(
    (data) => {
      if (!data.previousPrice) return true;
      const prev = Number(data.previousPrice.replace(",", "."));
      const current = Number(data.price.replace(",", "."));
      return prev >= current;
    },
    { message: "წინა ფასი უნდა იყოს მიმდინარე ფასზე მეტი ან ტოლი", path: ["previousPrice"] },
  );

export const adminCategorySaveSchema = z.object({
  id: z.string().trim().min(1).optional(),
  /** Empty slug is allowed on create — server generates a Latin slug from the Georgian name. */
  slug: z
    .string()
    .trim()
    .max(160, "Slug ძალიან გრძელია")
    .refine(
      (value) => value === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
      "Slug უნდა იყოს lowercase Latin kebab-case, მაგ: blenderi",
    )
    .refine((value) => !/[\u10A0-\u10FF]/.test(value), "Slug არ შეიძლება შეიცავდეს ქართულ ასოებს"),
  parentId: z.string().trim().min(1).nullable().optional(),
  imageUrl: z.string().trim().max(2000).optional().default(""),
  iconKey: z.string().trim().max(80).optional().default(""),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean(),
  indexable: z.boolean(),
  showInMainNav: z.boolean().optional().default(false),
  navSortOrder: z.number().int().min(0).max(9999).optional().default(0),
  showOnHomepage: z.boolean().optional().default(false),
  homepageSortOrder: z.number().int().min(0).max(9999).optional().default(0),
  translations: z.object({
    ka: z.object({
      name: z.string().trim().min(1, "შეიყვანეთ ქართული დასახელება").max(200),
      description: z.string().trim().max(4000).optional().default(""),
      seoTitle: z.string().trim().max(255).optional().default(""),
      seoDescription: z.string().trim().max(500).optional().default(""),
    }),
    en: z
      .object({
        name: z.string().trim().max(200).optional().default(""),
        description: z.string().trim().max(4000).optional().default(""),
        seoTitle: z.string().trim().max(255).optional().default(""),
        seoDescription: z.string().trim().max(500).optional().default(""),
      })
      .optional(),
    ru: z
      .object({
        name: z.string().trim().max(200).optional().default(""),
        description: z.string().trim().max(4000).optional().default(""),
        seoTitle: z.string().trim().max(255).optional().default(""),
        seoDescription: z.string().trim().max(500).optional().default(""),
      })
      .optional(),
  }),
});

export const adminBrandSaveSchema = z.object({
  id: z.string().trim().min(1).optional(),
  slug,
  logoUrl: z.string().trim().max(2000).optional().default(""),
  indexable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  showOnHomepage: z.boolean().optional().default(false),
  homepageSortOrder: z.number().int().min(0).max(9999).optional().default(0),
  translations: z.object({
    ka: z.object({
      name: z.string().trim().min(1, "შეიყვანეთ ქართული დასახელება").max(200),
      description: z.string().trim().max(4000).optional().default(""),
      seoTitle: z.string().trim().max(255).optional().default(""),
      seoDescription: z.string().trim().max(500).optional().default(""),
    }),
    en: z
      .object({
        name: z.string().trim().max(200).optional().default(""),
        description: z.string().trim().max(4000).optional().default(""),
        seoTitle: z.string().trim().max(255).optional().default(""),
        seoDescription: z.string().trim().max(500).optional().default(""),
      })
      .optional(),
    ru: z
      .object({
        name: z.string().trim().max(200).optional().default(""),
        description: z.string().trim().max(4000).optional().default(""),
        seoTitle: z.string().trim().max(255).optional().default(""),
        seoDescription: z.string().trim().max(500).optional().default(""),
      })
      .optional(),
  }),
});

export const adminHeroSlideSaveSchema = z.object({
  id: z.string().trim().min(1).optional(),
  imageUrl: z.string().trim().min(1, "ატვირთეთ ან შეიყვანეთ სურათი").max(2000),
  objectKey: z.string().trim().max(500).optional().nullable(),
  href: z.string().trim().max(2000).optional().default(""),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export const adminHeroReorderSchema = z.object({
  orderedIds: z.array(z.string().trim().min(1)).min(1).max(200),
});

export const adminPromotionSaveSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    code: z
      .string()
      .trim()
      .min(2, "შეიყვანეთ პრომოკოდი")
      .max(40, "პრომოკოდი ძალიან გრძელია")
      .regex(/^[A-Za-z0-9_-]+$/, "პრომოკოდი მხოლოდ ლათინური ასოები, ციფრები, - და _"),
    type: z.enum(["percentage", "fixed"]),
    value: moneyField("შეიყვანეთ ფასდაკლების მნიშვნელობა"),
    minOrderAmount: optionalMoneyField(),
    usageLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
    startsAt: z.string().trim().optional().default(""),
    endsAt: z.string().trim().optional().default(""),
    isActive: z.boolean(),
    name: z.string().trim().min(1, "შეიყვანეთ აქციის სახელი").max(200),
    description: z.string().trim().max(2000).optional().default(""),
  })
  .refine(
    (data) => {
      const amount = Number(data.value.replace(",", "."));
      if (!(amount > 0)) return false;
      if (data.type === "percentage" && amount > 100) return false;
      return true;
    },
    { message: "ფასდაკლება უნდა იყოს დადებითი; პროცენტი მაქსიმუმ 100", path: ["value"] },
  )
  .refine(
    (data) => {
      if (!data.startsAt || !data.endsAt) return true;
      return new Date(data.startsAt).getTime() <= new Date(data.endsAt).getTime();
    },
    { message: "დაწყების თარიღი უნდა იყოს დასრულებამდე", path: ["endsAt"] },
  );

export const adminOrderStatusSchema = z.object({
  orderId: z.string().trim().min(1),
  orderStatus: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]),
});

export const adminIdSchema = z.object({
  id: z.string().trim().min(1),
});

export const adminProductIdsSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "აირჩიეთ პროდუქტი").max(100, "მაქსიმუმ 100 პროდუქტი ერთდროულად"),
});

export const adminProductStockSchema = z.object({
  id: z.string().trim().min(1),
  inStock: z.boolean(),
});

export const adminBulkProductStockSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(100),
  inStock: z.boolean(),
});

export const adminProductPricesSchema = z
  .object({
    id: z.string().trim().min(1),
    price: moneyField("შეიყვანეთ ფასი"),
    previousPrice: optionalMoneyField(),
  })
  .superRefine((data, ctx) => {
    if (!data.previousPrice) return;
    const current = Number(data.price.replace(",", "."));
    const previous = Number(data.previousPrice.replace(",", "."));
    if (Number.isFinite(current) && Number.isFinite(previous) && previous < current) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["previousPrice"],
        message: "წინა ფასი უნდა იყოს მიმდინარე ფასზე მეტი ან ტოლი",
      });
    }
  });

export const adminReusableNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "შეიყვანეთ დასახელება")
    .max(80, "დასახელება ძალიან გრძელია"),
});

export const adminVariantOptionCreateSchema = z.object({
  attributeId: z.string().trim().min(1),
  name: z
    .string()
    .trim()
    .min(1, "შეიყვანეთ ფერი")
    .max(80, "დასახელება ძალიან გრძელია"),
});

export const adminSpecificationCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "შეიყვანეთ სპეციფიკაცია")
    .max(80, "დასახელება ძალიან გრძელია"),
});

export const adminSpecificationValueCreateSchema = z.object({
  specificationId: z.string().trim().min(1),
  name: z
    .string()
    .trim()
    .min(1, "შეიყვანეთ მნიშვნელობა")
    .max(80, "მნიშვნელობა ძალიან გრძელია"),
});

export const adminSpecificationRenameSchema = z.object({
  id: z.string().trim().min(1),
  name: z
    .string()
    .trim()
    .min(1, "შეიყვანეთ დასახელება")
    .max(80, "დასახელება ძალიან გრძელია"),
});

/** Drag/drop hierarchy move: parentId + sibling index under that parent. */
export const adminCategoryTreeMoveSchema = z.object({
  categoryId: z.string().trim().min(1),
  newParentId: z.string().trim().min(1).nullable(),
  indexAmongSiblings: z.number().int().min(0).max(10_000),
});

export type AdminProductSaveInput = z.infer<typeof adminProductSaveSchema>;
export type AdminCategorySaveInput = z.infer<typeof adminCategorySaveSchema>;
export type AdminBrandSaveInput = z.infer<typeof adminBrandSaveSchema>;
export type AdminHeroSlideSaveInput = z.infer<typeof adminHeroSlideSaveSchema>;
export type AdminPromotionSaveInput = z.infer<typeof adminPromotionSaveSchema>;
export type AdminCategoryTreeMoveInput = z.infer<typeof adminCategoryTreeMoveSchema>;

export { slug as adminSlugSchema, optionalSlug, moneyField, optionalMoneyField, optionalText };
