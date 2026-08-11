import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Roles } from 'src/auth/decorators/user-role.decorator';
import { AuthRolesGuard } from 'src/auth/guards/auth-roles.guard';
import { UserType } from 'src/utils/enums';
import { JWTPayload } from 'src/utils/types';

@Controller('statistics')
export class StatisticsController {
    constructor(private readonly statisticsService: StatisticsService) { }




    @Get('my-statistics')
    @Roles(
        UserType.ADMIN,
        UserType.MANAGER,
        UserType.LEADER,
        UserType.SUPERVISOR,
        UserType.REP,
    )
    @UseGuards(AuthRolesGuard)
    getMyStatistics(@CurrentUser() user: JWTPayload) {
        const employeeId = user.sub;
        return this.statisticsService.getStatisticsForEmployeeHierarchy(employeeId);
    }


    // for PROCESSOR
    @Get('processor-statistics')
    @Roles(
        UserType.PROCESSOR,
    )
    @UseGuards(AuthRolesGuard)
    getProcessorStatistics(@CurrentUser() user: JWTPayload) {
        const employeeId = user.sub;
        return this.statisticsService.getStatisticsForProcessor(employeeId);
    }


    // for admin panel dashboard and employee parant
    @Get(':employeeId')
    @Roles(
        UserType.ADMIN,
        UserType.MANAGER,
        UserType.LEADER,
        UserType.SUPERVISOR,
        UserType.REP,
    )
    @UseGuards(AuthRolesGuard)
    getStatistics(@Param('employeeId') employeeId: string) {
        return this.statisticsService.getStatisticsForEmployeeHierarchy(employeeId);
    }
}
