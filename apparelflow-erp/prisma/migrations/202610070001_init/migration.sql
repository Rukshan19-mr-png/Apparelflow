-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipe_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "std_fabric_yards" REAL NOT NULL,
    "wastage_cap" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "recipe_components" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipe_id" TEXT NOT NULL,
    "component_name" TEXT NOT NULL,
    "pieces_per_garment" INTEGER NOT NULL,
    "image_url" TEXT,
    CONSTRAINT "recipe_components_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cutting_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_no" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "target_qty" INTEGER NOT NULL,
    "fabric_roll_id" TEXT NOT NULL,
    "actual_fabric_yds" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "cutting_orders_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cutting_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "expected_qty" INTEGER NOT NULL,
    "actual_qty" INTEGER,
    "status" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verification_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "cutting_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "verification_items_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "recipe_components" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "verifier_id" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "rejection_note" TEXT,
    "wastage_pct" REAL NOT NULL,
    "component_variance_json" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verification_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "cutting_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "verification_logs_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_recipe_code_key" ON "recipes"("recipe_code");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_components_recipe_id_component_name_key" ON "recipe_components"("recipe_id", "component_name");

-- CreateIndex
CREATE UNIQUE INDEX "cutting_orders_order_no_key" ON "cutting_orders"("order_no");

-- CreateIndex
CREATE UNIQUE INDEX "verification_items_order_id_component_id_key" ON "verification_items"("order_id", "component_id");
