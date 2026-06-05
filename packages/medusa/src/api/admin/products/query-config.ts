import { defaultAdminProductVariantFields } from "../product-variants/query-config"

/**
 * Product-related entity names for query configuration.
 */
export enum Entities {
  product = "product",
  product_option = "product_option",
  product_variant = "product_variant",
  inventory_item = "inventory_item",
  price = "price",
}

/**
 * Default fields for admin product variants, excluding the product relation.
 */
export const defaultAdminProductsVariantFields =
  defaultAdminProductVariantFields.filter((field) => field !== "*product")

/**
 * Query configuration for retrieving a single product variant.
 */
export const retrieveVariantConfig = {
  defaults: defaultAdminProductsVariantFields,
  isList: false,
  entity: Entities.product_variant,
}

/**
 * Query configuration for listing product variants.
 */
export const listVariantConfig = {
  ...retrieveVariantConfig,
  defaultLimit: 50,
  isList: true,
  entity: Entities.product_variant,
}

/**
 * Default fields for admin product options.
 */
export const defaultAdminProductsOptionFields = ["id", "title"]

/**
 * Query configuration for retrieving a single product option.
 */
export const retrieveOptionConfig = {
  defaults: defaultAdminProductsOptionFields,
  isList: false,
  entity: Entities.product_option,
}

/**
 * Query configuration for listing product options.
 */
export const listOptionConfig = {
  ...retrieveOptionConfig,
  defaultLimit: 50,
  isList: true,
  entity: Entities.product_option,
}

/**
 * Default fields for a single product (detail/retrieve view).
 * Includes all relations, nested prices with rules, options, etc.
 */
const defaultAdminProductFields = [
  "id",
  "title",
  "subtitle",
  "status",
  "external_id",
  "meta_keywords",
  "description",
  "handle",
  "is_giftcard",
  "discountable",
  "thumbnail",
  "collection_id",
  "type_id",
  "weight",
  "length",
  "height",
  "width",
  "hs_code",
  "origin_country",
  "mid_code",
  "material",
  "created_at",
  "updated_at",
  "deleted_at",
  "metadata",
  "*type",
  "*collection",
  "*options",
  "*options.values",
  "*tags",
  "*images",
  "*variants",
  "*variants.prices",
  "variants.prices.price_rules.value",
  "variants.prices.price_rules.attribute",
  "*variants.options",
  "*variants.images",
  "*sales_channels",
]

/**
 * Lightweight default fields for product LISTING.
 *
 * Heavy relations that each generate an additional SQL query via MikroORM's
 * SELECT_IN strategy are excluded:
 *   - type, options, options.values, tags, images → PDP-level only
 *   - variants.prices, price_rules, variants.options, variants.images → PDP-level only
 *   - full *variants → only variants.id is kept for variant count display
 *
 * If the client needs those, pass explicit fields[] in the request.
 */
const listAdminProductFields = [
  "id",
  "title",
  "subtitle",
  "status",
  "external_id",
  "meta_keywords",
  "description",
  "handle",
  "is_giftcard",
  "discountable",
  "thumbnail",
  "collection_id",
  "type_id",
  "weight",
  "length",
  "height",
  "width",
  "hs_code",
  "origin_country",
  "mid_code",
  "material",
  "created_at",
  "updated_at",
  "*collection",
  "*sales_channels",
  "variants.id",
]

/**
 * Query configuration for retrieving a single product.
 */
export const retrieveProductQueryConfig = {
  defaults: defaultAdminProductFields,
  isList: false,
  entity: Entities.product,
}

/**
 * Query configuration for listing products.
 */
export const listProductQueryConfig = {
  defaults: listAdminProductFields,
  defaultLimit: 50,
  isList: true,
  entity: Entities.product,
}
