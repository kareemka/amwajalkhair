import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JenniService } from './jenni.service';
import { JenniController } from './jenni.controller';
import { OrderModule } from '../order/order.module';

@Module({
    imports: [
        ConfigModule,
        forwardRef(() => OrderModule),
    ],
    controllers: [JenniController],
    providers: [JenniService],
    exports: [JenniService],
})
export class JenniModule {}
