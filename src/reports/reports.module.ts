import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from 'src/order/entities/order.entity';
import { Employee } from 'src/employee/entities/employee.entity';
import { EmployeeService } from 'src/employee/employee.service';
import { AuthModule } from 'src/auth/auth.module';
import { SettingsModule } from 'src/settings/settings.module';
import { Expense } from 'src/expenses/entities/expense.entity';
import { ReportsPDFService } from './reportsPDF.service';
import { EmployeeModule } from 'src/employee/employee.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Employee, Expense]),
    AuthModule,
    SettingsModule,
    EmployeeModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsPDFService],
  exports: [ReportsService],
})
export class ReportsModule { }
