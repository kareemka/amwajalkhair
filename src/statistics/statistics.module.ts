import { Module, forwardRef } from '@nestjs/common';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../employee/entities/employee.entity';
import { CustomerPoint } from '../customer-points/entities/customer-point.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Order } from 'src/order/entities/order.entity';
import { Setting } from 'src/settings/entities/setting.entity';
import { AuthModule } from 'src/auth/auth.module';
import { OrderNotification } from 'src/notification/entities/order-notification.entity';
import { EmployeeAlert } from 'src/alerts/entities/employee-alert.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, Order, CustomerPoint, Expense, Setting, OrderNotification, EmployeeAlert]),
    forwardRef(() => AuthModule),
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule { }
