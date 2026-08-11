import { Module } from '@nestjs/common';
import { ExpenseController } from './expense.controller';
import { ExpenseService } from './expense.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from 'src/employee/entities/employee.entity';
import { Expense } from './entities/expense.entity';
import { AuthModule } from 'src/auth/auth.module';
import { EmployeeModule } from 'src/employee/employee.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense, Employee]),
    AuthModule,
    EmployeeModule,
  ],
  controllers: [ExpenseController],
  providers: [ExpenseService],
  exports: [ExpenseService],
})
export class ExpensesModule { }
