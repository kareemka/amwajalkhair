import { IsEnum, IsNotEmpty, IsNumber, Min, IsString } from 'class-validator';
import { ExpenseType } from '../entities/expense.entity';

export class CreateExpenseDto {
    @IsNumber()
    @Min(1)
    amount: number;

    @IsString()
    @IsNotEmpty()
    transferType: string;  // نوع التحويل نص

    @IsEnum(ExpenseType)
    type: ExpenseType;     // إيداع أو سحب

    @IsString()
    @IsNotEmpty()
    employeeId: string;
}
