import { SetMetadata } from "@nestjs/common";
import { UserType } from "src/utils/enums";


export const Roles = (...roles: UserType[]) => SetMetadata('roles', roles);