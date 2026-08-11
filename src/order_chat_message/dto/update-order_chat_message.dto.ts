import { PartialType } from '@nestjs/mapped-types';
import { CreateOrderChatMessageDto } from './create-order_chat_message.dto';

export class UpdateOrderChatMessageDto extends PartialType(CreateOrderChatMessageDto) {}
