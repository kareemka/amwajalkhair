import { PartialType } from '@nestjs/mapped-types';
import { CreateOrderNotificationDto } from './create-order-notification.dto';

export class UpdateOrderNotificationDto extends PartialType(CreateOrderNotificationDto) {}
