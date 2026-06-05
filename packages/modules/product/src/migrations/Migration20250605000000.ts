import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20250605000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product" add column if not exists "meta_keywords" text null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "product" drop column if exists "meta_keywords";`
    )
  }
}
