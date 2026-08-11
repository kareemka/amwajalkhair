import { Module } from '@nestjs/common';
import { CustomerPointsService } from './customer-points.service';
import { CustomerPointsController } from './customer-points.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from 'src/employee/entities/employee.entity';
import { CustomerPoint } from './entities/customer-point.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerPoint, Employee])
  ],
  controllers: [CustomerPointsController],
  providers: [CustomerPointsService],
})
export class CustomerPointsModule { }
