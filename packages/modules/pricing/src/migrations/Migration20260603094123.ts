import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260603094123 extends Migration {
  override async up(): Promise<void> {
    // Composite index for the calculatePrices query:
    //   WHERE price.price_set_id IN (...) AND price.currency_code = ?
    // The leading column (price_set_id) matches the IN clause while
    // currency_code is an equality filter — a composite index avoids
    // having to bitmap-combine two standalone indexes or filter rows
    // in a heap scan.
    this.addSql(
      `create index if not exists "IDX_price_price_set_id_currency_code"
       on "price" ("price_set_id", "currency_code")
       where "deleted_at" is null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop index if exists "IDX_price_price_set_id_currency_code";`
    )
  }
}
