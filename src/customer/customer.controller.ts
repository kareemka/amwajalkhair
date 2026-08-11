import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Roles } from 'src/auth/decorators/user-role.decorator';
import { UserType } from 'src/utils/enums';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthRolesGuard } from 'src/auth/guards/auth-roles.guard';
import { JWTPayload } from 'src/utils/types';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { OrderService } from 'src/order/order.service';
import { CreateCustomerOrderDto } from './dto/create-customer-order.dto';
import { PaginationDto } from './dto/pagination.dto';
import { DeleteManyCustomersDto } from './dto/delete-many.dto';
import { AdminUpdatePasswordDto } from './dto/admin-update-password.dto';



@Controller('customer')
export class CustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly orderService: OrderService,
  ) { }

  // ===============================
  // 🛒 إنشاء طلب (عميل)
  // ===============================
  @Post()
  @Roles(UserType.CUSTOMER)
  @UseGuards(AuthRolesGuard)
  create(
    @CurrentUser() user: JWTPayload,
    @Body() dto: CreateCustomerOrderDto,
  ) {
    return this.orderService.createByCustomer(user.sub, dto);
  }

  // ===============================
  // 👤 بياناتي
  // ===============================
  @Get('me')
  @Roles(UserType.CUSTOMER)
  @UseGuards(AuthRolesGuard)
  getMyProfile(
    @CurrentUser() user: JWTPayload,
  ) {
    return this.customerService.findOne(user.sub);
  }

  // ===============================
  // ✏️ تحديث بياناتي
  // ===============================
  @Patch('me/profile')
  @Roles(UserType.CUSTOMER)
  @UseGuards(AuthRolesGuard)
  updateProfile(
    @CurrentUser() user: JWTPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.customerService.updateProfile(user.sub, dto);
  }

  // ===============================
  // 🔐 تغيير كلمة المرور
  // ===============================
  @Patch('me/change-password')
  @Roles(UserType.CUSTOMER)
  @UseGuards(AuthRolesGuard)
  changePassword(
    @CurrentUser() user: JWTPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.customerService.changePassword(user.sub, dto);
  }

  // ===============================
  // 🗑️ حذف حسابي
  // ===============================
  @Delete('me')
  @Roles(UserType.CUSTOMER)
  @UseGuards(AuthRolesGuard)
  deleteMyAccount(
    @CurrentUser() user: JWTPayload,
  ) {
    return this.customerService.deleteMyAccount(user.sub);
  }

  // ===============================
  // 🧑‍💼 جميع العملاء (أدمن + Pagination)
  // ===============================
  @Get()
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  findAll(
    @Query() query: PaginationDto,
  ) {
    return this.customerService.findAllWithPagination(
      query.page,
      query.limit,
    );
  }

  // ===============================
  // 🔍 عميل واحد (أدمن)
  // ===============================
  @Get(':id')
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  findOneByAdmin(
    @Param('id') id: string,
  ) {
    return this.customerService.findOne(id);
  }


  // ===============================
  // 🔑 تحديث كلمة مرور العميل بواسطة الأدمن
  // ===============================
  @Patch(':id/password')
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  adminUpdatePassword(
    @Param('id') id: string,
    @Body() dto: AdminUpdatePasswordDto,
  ) {
    return this.customerService.adminUpdatePassword(id, dto.newPassword);
  }


  // ===============================
  // ✏️ تحديث عميل (أدمن)
  // ===============================
  @Patch(':id')
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customerService.update(+id, updateCustomerDto);
  }

  // ===============================
  // 🚫 حظر حساب
  // ===============================
  @Patch(':id/block')
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  block(
    @Param('id') id: string,
  ) {
    return this.customerService.blockCustomer(id);
  }

  // ===============================
  // ✅ فك حظر حساب
  // ===============================
  @Patch(':id/unblock')
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  unblock(
    @Param('id') id: string,
  ) {
    return this.customerService.unblockCustomer(id);
  }

  // ===============================
  // 🗑️ حذف حساب (أدمن)
  // ===============================
  @Delete(':id')
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  remove(
    @Param('id') id: string,
  ) {
    return this.customerService.deleteByAdmin(id);
  }

  // ===============================
  // 🗑️🗑️ حذف متعدد
  // ===============================
  @Post('delete-many')
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  deleteMany(
    @Body() dto: DeleteManyCustomersDto,
  ) {
    return this.customerService.deleteManyByAdmin(dto.ids);
  }

}
