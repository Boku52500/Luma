import "server-only";

export { getR2Config, isStorageConfigured, STORAGE_NOT_CONFIGURED } from "@/server/storage/config";
export {
  createProductImageObjectKey,
  createPendingProductImageObjectKey,
  createHeroImageObjectKey,
  createBrandLogoObjectKey,
  createCategoryImageObjectKey,
  createHomepageImageObjectKey,
  isManagedProductImageKey,
  isPendingProductImageKey,
  isManagedMerchImageKey,
  publicUrlForObjectKey,
} from "@/server/storage/keys";
export { processProductImage, ProductImageValidationError } from "@/server/storage/processImage";
export { putProductImageObject, deleteProductImageObject } from "@/server/storage/r2";
