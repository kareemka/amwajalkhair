import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { Employee } from 'src/employee/entities/employee.entity';
import { Admin } from 'src/admin/entities/admin.entity';
import { UserType } from 'src/utils/enums';
import { Customer } from 'src/customer/entities/customer.entity';
import { CreateCustomerDto } from 'src/customer/dto/create-customer.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,

    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,

    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,

    private jwt: JwtService,
  ) { }

  // تسجيل دخول الموظف
  async loginEmployee(username: string, password: string) {
    const employee = await this.employeeRepo.findOne({
      where: { username },
    });

    if (!employee) {
      throw new UnauthorizedException('Invalid username or password');
    }

    if (employee.isBlocked) {
      throw new ForbiddenException('هذا الحساب محظور');
    }


    const isMatch = await bcrypt.compare(password, employee.password);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const payload = {
      sub: employee.id,
      username: employee.username,
      role: employee.role,
      userType: 'EMPLOYEE',
    };

    const token = this.jwt.sign(payload);

    return {
      access_token: token,
      user: employee,
      userType: 'EMPLOYEE',
    };
  }

  // تسجيل دخول الأدمن
  async loginAdmin(username: string, password: string) {
    const admin = await this.adminRepo.findOne({
      where: { username },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const payload = {
      sub: admin.id,
      username: admin.username,
      role: 'ADMIN',
      userType: 'ADMIN',
    };

    const token = this.jwt.sign(payload);

    return {
      access_token: token,
      user: admin,
      userType: 'ADMIN',
    };
  }


  // تسجيل دخول العميل
  async customerLogin(username: string, password: string) {
    const customer = await this.customerRepo.findOne({
      where: { username },
      relations: ['employee'],
    });
    if (!customer) {
      throw new UnauthorizedException('Invalid username or password');
    }
    if (customer.isBlocked) {
      throw new ForbiddenException('هذا الحساب محظور');
    }
    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid username or password');
    }
    const payload = {
      sub: customer.id,
      username: customer.username,
      userType: 'CUSTOMER',
      createdAt: customer.createdAt.toISOString(),
    };
    const token = this.jwt.sign(payload);
    return {
      access_token: token,
      user: customer,
      userType: 'CUSTOMER',
    };
  }


  // تسجيل عميل جديد
  async customerRegister(dto: CreateCustomerDto) {
    const { username, password, name, phone, employeeId, isBlocked } = dto;

    // تحقق من الموظف
    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // تحقق من username
    const existingCustomer = await this.customerRepo.findOne({
      where: { username },
    });

    if (existingCustomer) {
      throw new ForbiddenException('Username already taken');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newCustomer = this.customerRepo.create({
      name,
      username,
      phone,
      password: hashedPassword,
      employeeId,
      employee,
      isBlocked: isBlocked ?? false,
    });

    await this.customerRepo.save(newCustomer);


    const payload = {
      sub: newCustomer.id,
      username: newCustomer.username,
      userType: 'CUSTOMER',
      createdAt: newCustomer.createdAt.toISOString(),
    };
    const token = this.jwt.sign(payload);
    return {
      access_token: token,
      user: newCustomer,
      userType: 'CUSTOMER',
    };

  }







  // دالة موحدة للبحث عن المستخدم
  async findUserById(id: string) {
    // البحث في جدول الموظفين
    const employee = await this.employeeRepo.findOne({ where: { id } });
    if (employee) {
      return {
        ...employee,
        userType: 'EMPLOYEE',
      };
    }

    // البحث في جدول الزبائن
    const customer = await this.customerRepo.findOne({
      where: { id },
      relations: ['employee'],
    });

    if (customer) {
      return {
        ...customer,
        userType: 'CUSTOMER',
        role: UserType.CUSTOMER,
      };
    }

    // البحث في جدول الأدمن
    const admin = await this.adminRepo.findOne({ where: { id } });
    if (admin) {
      return {
        ...admin,
        isBlocked: false,
        role: UserType.ADMIN,
        userType: UserType.ADMIN,
      };
    }

    return null;
  }
}