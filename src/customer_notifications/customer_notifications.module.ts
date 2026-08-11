import { Module } from '@nestjs/common';
import { CustomerNotificationsService } from './customer_notifications.service';
import { CustomerNotificationsController } from './customer_notifications.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerNotification } from './entities/customer_notification.entity';
import { CustomerNotificationRead } from './entities/customer-notification-read.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerNotification, CustomerNotificationRead]), AuthModule,],
  controllers: [CustomerNotificationsController],
  providers: [CustomerNotificationsService],
})
export class CustomerNotificationsModule {}
