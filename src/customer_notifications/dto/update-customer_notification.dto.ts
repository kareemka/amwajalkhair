import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomerNotificationDto } from './create-customer_notification.dto';

export class UpdateCustomerNotificationDto extends PartialType(CreateCustomerNotificationDto) {}
