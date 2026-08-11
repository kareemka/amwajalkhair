import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { OrderChatMessageService } from './order_chat_message.service';
import { Roles } from 'src/auth/decorators/user-role.decorator';
import { UserType } from 'src/utils/enums';
import { AuthRolesGuard } from 'src/auth/guards/auth-roles.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JWTPayload } from 'src/utils/types';

@Controller('order-chat-message')
export class OrderChatMessageController {
  constructor(private service: OrderChatMessageService) { }

  // إرسال رسالة
  @Post(':orderId')
  @Roles(
    UserType.PROCESSOR,
    UserType.REP,
    UserType.SUPERVISOR,
    UserType.LEADER,
    UserType.MANAGER
  )
  @UseGuards(AuthRolesGuard)
  async sendMessage(
    @CurrentUser() user: JWTPayload,
    @Param('orderId') orderId: string,
    @Body('message') message: string,
  ) {
    const senderId = user.sub;
    return this.service.sendMessageAuto(+orderId, senderId, message);
  }



  // جلب كل الرسائل حسب orderId 
  @Get(':orderId')
  @Roles(UserType.ADMIN, UserType.PROCESSOR, UserType.REP, UserType.SUPERVISOR, UserType.LEADER, UserType.MANAGER)
  @UseGuards(AuthRolesGuard)
  async getOrderMessages(@Param('orderId') orderId: string) {
    return this.service.getOrderMessages(+orderId);
  }
}
