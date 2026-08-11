npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:generate src/migrations/InitMigration -d src/data-source.ts



npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:run -d src/data-source.ts



<!-- جديد بعد اضافة updatedAt الى جدول الطلبات -->
npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:generate -n AddUpdatedAtToOrder -d src/data-source.ts

npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:run -d src/data-source.ts


<!-- بعد اضافة statusUpdatedAt -->
npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:generate -n AddStatusUpdatedAtToOrder -d src/data-source.ts

npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:run -d src/data-source.ts




======
