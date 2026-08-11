import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from 'src/employee/entities/employee.entity';
import { Admin } from 'src/admin/entities/admin.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, Admin])],
  exports: [TypeOrmModule],
})
export class UserRepositorieModule {}
