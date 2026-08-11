import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import * as bcrypt from 'bcryptjs';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';


@Injectable()
export class CustomerService {


  constructor(
    @InjectRepository(Customer)
    private repo: Repository<Customer>,
  ) { }

  create(createCustomerDto: CreateCustomerDto) {
    return 'This action adds a new customer';
  }





  async findAllWithPagination(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [customers, total] = await this.repo.findAndCount({
      skip,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
      relations: ['employee'], // ⬅️ جلب بيانات الموظف المسؤول
    });

    const dataWithEmployeeName = customers.map(cust => ({
      ...cust,
      employeeName: cust.employee?.name || null,
    }));

    return {
      data: dataWithEmployeeName,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }



  async findOne(id: string) {
    const customer = await this.repo.findOne({
      where: { id },
      relations: ['employee'],
    });

    if (!customer) throw new NotFoundException('Customer not found');

    return customer;
  }



  async adminUpdatePassword(customerId: string, newPassword: string) {
    const customer = await this.repo.findOne({
      where: { id: customerId },
      select: ['id', 'password'], // تأكد من اختيار كلمة المرور
    });

    if (!customer) throw new NotFoundException('Customer not found');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    customer.password = hashedPassword;

    await this.repo.save(customer);

    return { message: 'Password updated successfully by admin' };
  }




  async changePassword(
    customerId: string,
    dto: ChangePasswordDto,
  ) {
    const customer = await this.repo.findOne({
      where: { id: customerId },
      select: ['id', 'password'], // مهم
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.oldPassword,
      customer.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Old password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    customer.password = hashedPassword;

    await this.repo.save(customer);

    return { message: 'Password changed successfully' };
  }

  async deleteMyAccount(customerId: string) {
    const customer = await this.repo.findOne({ where: { id: customerId } });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    await this.repo.remove(customer);

    return { message: 'Account deleted successfully' };
  }



  async updateProfile(
    customerId: string,
    dto: UpdateProfileDto,
  ) {
    const customer = await this.repo.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (dto.name !== undefined) {
      customer.name = dto.name;
    }

    if (dto.phone !== undefined) {
      customer.phone = dto.phone;
    }

    await this.repo.save(customer);

    return {
      message: 'Profile updated successfully',
      customer,
    };
  }



  async blockCustomer(id: string) {
    const customer = await this.repo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');

    customer.isBlocked = true;
    await this.repo.save(customer);

    return { message: 'Customer blocked successfully' };
  }


  async unblockCustomer(id: string) {
    const customer = await this.repo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');

    customer.isBlocked = false;
    await this.repo.save(customer);

    return { message: 'Customer unblocked successfully' };
  }



  update(id: number, updateCustomerDto: UpdateCustomerDto) {
    return `This action updates a #${id} customer`;
  }

  async deleteByAdmin(id: string) {
    const customer = await this.repo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');

    await this.repo.remove(customer);
    return { message: 'Customer deleted successfully' };
  }

  async deleteManyByAdmin(ids: string[]) {
    await this.repo.delete(ids);

    return {
      message: 'Customers deleted successfully',
      deletedCount: ids.length,
    };
  }

}
