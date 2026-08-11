import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { StatisticsModule } from '../statistics/statistics.module';
import { AuthModule } from '../auth/auth.module';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { EmployeeModule } from '../employee/employee.module';
import { OrderModule } from '../order/order.module';
import { ProductModule } from '../product/product.module';
import { CustomerModule } from '../customer/customer.module';
import { ExpensesModule } from '../expenses/expenses.module';

@Module({
  imports: [
    ReportsModule,
    StatisticsModule,
    AuthModule,
    EmployeeModule,
    OrderModule,
    ProductModule,
    CustomerModule,
    ExpensesModule,
  ],
  controllers: [AiAssistantController],
  providers: [AiAssistantService],
})
export class AiAssistantModule { }
