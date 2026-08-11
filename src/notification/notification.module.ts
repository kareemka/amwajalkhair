import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { OrderNotification } from './entities/order-notification.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { EmployeeModule } from 'src/employee/employee.module';

@Module({
  imports: [TypeOrmModule.forFeature([OrderNotification]), AuthModule, EmployeeModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
