import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from './entities/admin.entity';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginAdminDto } from './dto/login-admin.dto';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Admin)
    private adminRepo: Repository<Admin>,
    private jwt: JwtService,
  ) { }


  async createDefaultAdmin() {
    const count = await this.adminRepo.count();
    if (count === 0) {
      const hash = await bcrypt.hash('1234', 10);
      const admin = this.adminRepo.create({
        username: 'admin',
        fullName: 'Super Admin',
        password: hash,
      });
      await this.adminRepo.save(admin);
      console.log('Default admin created: username=admin, password=1234');
    }
  }


  async register(dto: CreateAdminDto) {
    const exists = await this.adminRepo.findOne({ where: { username: dto.username } });
    if (exists) throw new BadRequestException('Username already exists');

    const hash = await bcrypt.hash(dto.password, 10);
    const admin = this.adminRepo.create({ username: dto.username, fullName: dto.fullName, password: hash });
    await this.adminRepo.save(admin);

    return { message: 'Admin created', admin };
  }

  async login(dto: LoginAdminDto) {
    const admin = await this.adminRepo.findOne({ where: { username: dto.username } });
    if (!admin) throw new UnauthorizedException('Invalid username or password');

    const valid = await bcrypt.compare(dto.password, admin.password);
    if (!valid) throw new UnauthorizedException('Invalid username or password');




    const payload = { sub: admin.id, username: admin.username, role: 'ADMIN', userType: 'ADMIN' };
    const token = this.jwt.sign(payload);

    return { token };
  }

  // -----------------------------------------------------------
  // جلب بيانات الادمن من الـ token
  // -----------------------------------------------------------
  async getProfile(adminId: string) {
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');

    return {
      id: admin.id,
      username: admin.username,
      fullName: admin.fullName,
      createdAt: admin.createdAt,
    };
  }

  // -----------------------------------------------------------
  // تحديث كلمة المرور
  // -----------------------------------------------------------
  async updatePassword(adminId: string, newPassword: string) {
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');

    // تشفير كلمة المرور الجديدة
    const newHash = await bcrypt.hash(newPassword, 10);
    admin.password = newHash;

    await this.adminRepo.save(admin);

    return { message: 'Password updated successfully' };
  }

}
