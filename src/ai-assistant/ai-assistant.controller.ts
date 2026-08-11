import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthRolesGuard } from '../auth/guards/auth-roles.guard';
import { Roles } from '../auth/decorators/user-role.decorator';
import { UserType } from '../utils/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JWTPayload } from '../utils/types';
import { AiAssistantService } from './ai-assistant.service';
import { EmployeeService } from '../employee/employee.service';

@Controller('ai-assistant')
export class AiAssistantController {
  constructor(
    private readonly aiAssistantService: AiAssistantService,
    private readonly employeeService: EmployeeService,
  ) { }

  @Post('ask')
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.LEADER, UserType.SUPERVISOR, UserType.REP)
  @UseGuards(AuthRolesGuard)
  async ask(
    @Body('prompt') prompt: string,
    @Body('employeeId') employeeIdParam: string,
    @Body('history') history: any[] = [],
    @CurrentUser() user: JWTPayload,
  ) {
    let targetEmployeeId = employeeIdParam;

    // إذا لم يتم توفير معرف موظف والمستخدم الحالي ليس موظفاً (مثلاً أدمن)
    // نحاول جلب أول موظف قيادي (Leader) كمرجع افتراضي للبيانات
    if (!targetEmployeeId) {
      if (user.userType === 'EMPLOYEE') {
        targetEmployeeId = user.sub;
      } else {
        // للمدراء (ADMIN/MANAGER): ابحث عن أول قائد في النظام إذا لم يتم تحديد واحد
        const leaders = await this.employeeService.allEmployees();
        if (leaders.length > 0) {
          targetEmployeeId = leaders[0].id;
        }
      }
    }

    const reply = await this.aiAssistantService.askAssistant(prompt, targetEmployeeId, history);
    return { reply };
  }
}
