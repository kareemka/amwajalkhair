import { Module, forwardRef } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity';
import { Customer } from 'src/customer/entities/customer.entity';
import { AuthModule } from 'src/auth/auth.module';
import { StatisticsModule } from 'src/statistics/statistics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, Customer]),
    forwardRef(() => AuthModule),
    forwardRef(() => StatisticsModule),
  ],
  controllers: [EmployeeController],
  providers: [EmployeeService],
  exports: [EmployeeService],
})
export class EmployeeModule { }
