// Shared base fields: common scalar + relation fields for both list and retrieve
const defaultStoreProductFields = [
  "id",
  "title",
  "subtitle",
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
  "*type",
  "*collection",
  "*options",
  "*options.values",
  "*tags",
  "*images",
  "*variants",
  "*variants.options",
]

// Lightweight default fields for product LISTING (grid / collection view).
// Heavy relations (type, collection, tags, options, options.values, variants.options)
// are intentionally excluded — they are PDP-level and each adds a separate SQL query
// via MikroORM's SELECT_IN strategy. If the client needs them, pass explicit `fields[]`.
const listStoreProductFields = [
  "id",
  "title",
  "subtitle",
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
  "*images",
  "*variants",
]

export const retrieveProductQueryConfig = {
  defaults: defaultStoreProductFields,
  isList: false,
}

export const listProductQueryConfig = {
  defaults: listStoreProductFields,
  defaultLimit: 50,
  isList: true,
}
