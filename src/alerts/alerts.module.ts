import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeAlert } from './entities/employee-alert.entity';
import { Alert } from './entities/alert.entity';
import { Employee } from 'src/employee/entities/employee.entity';
import { AuthModule } from 'src/auth/auth.module';
import { NotificationModule } from 'src/notification/notification.module';


@Module({
  imports: [TypeOrmModule.forFeature([EmployeeAlert, Alert, Employee]),
  AuthModule,
  NotificationModule,

],
  controllers: [AlertsController],
  providers: [AlertsService],
})
export class AlertsModule {}
