
// generator client {
//   provider = "prisma-client"
//   output   = "../generated/prisma"
// }

// datasource db {
//   provider = "postgresql"
//   url      = env("DATABASE_URL")
// }


generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum EmployeeRole {
  LEADER
  MANAGER
  SUPERVISOR
  REP
}

model Employee {
  id        Int        @id @default(autoincrement())
  name      String
  role      EmployeeRole
  parentId  Int?
  parent    Employee?  @relation("EmployeeToEmployee", fields: [parentId], references: [id])
  children  Employee[] @relation("EmployeeToEmployee")
  orders    Order[]
}

model Order {
  id          Int       @id @default(autoincrement())
  details     String
  employeeId  Int
  employee    Employee  @relation(fields: [employeeId], references: [id])
  createdAt   DateTime  @default(now())
}

model Admin {
  id           String   @id @default(cuid())
  username     String   @unique
  fullName     String
  password     String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}   