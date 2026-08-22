import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AdminModule } from './admin/admin.module';
import { AlertsModule } from './alerts/alerts.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CustomerPointsModule } from './customer-points/customer-points.module';
import { EmployeeModule } from './employee/employee.module';
import { ExpensesModule } from './expenses/expenses.module';
// import { FirebaseModule } from './firebase/firebase.module';
import { NotificationModule } from './notification/notification.module';
import { OrderItemModule } from './order-item/order-item.module';
import { OrderStatusLogModule } from './order-status-log/order-status-log.module';
import { OrderModule } from './order/order.module';
import { OrderChatMessageModule } from './order_chat_message/order_chat_message.module';
import { ProductModule } from './product/product.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { StatisticsModule } from './statistics/statistics.module';
import { UserRepositorieModule } from './user-repositorie/user-repositorie.module';
import { AdminService } from './admin/admin.service';
import { CustomerModule } from './customer/customer.module';
import { CustomerNotificationsModule } from './customer_notifications/customer_notifications.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JenniModule } from './jenni/jenni.module';
import { APP_GUARD } from '@nestjs/core';
import { AiAssistantModule } from './ai-assistant/ai-assistant.module';


@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
    }),
    ConfigModule.forRoot({
      isGlobal: true, // يجعل .env متاح في كل المشروع
       envFilePath: '.env.production',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule], // 👈 مهم جدًا
      inject: [ConfigService], // 👈 بدون هذا لن يحقن ConfigService
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        synchronize: true, // عمل migaration تلقائيا نعطلة في الانتاج
        // migrationsRun: false, // سنقوم بتشغيلها يدويًا
        autoLoadEntities: true,
        migrations: ['dist/migrations/*.js'],
      }),
    }),

    // TypeOrmModule.forRootAsync({
    //   imports: [ConfigModule],
    //   inject: [ConfigService],
    //   useFactory: (configService: ConfigService) => ({
    //     type: 'postgres',
    //     host: configService.get<string>('DB_HOST'),
    //     port: configService.get<number>('DB_PORT'),
    //     username: configService.get<string>('DB_USERNAME'),
    //     password: configService.get<string>('DB_PASSWORD'),
    //     database: configService.get<string>('DB_NAME'),
    //     autoLoadEntities: true,
    //     synchronize: true, // للإنتاج حط false
    //   }),
    // }),

    AdminModule,
    AuthModule,
    EmployeeModule,
    OrderModule,
    ProductModule,
    OrderItemModule,
    UserRepositorieModule,
    OrderStatusLogModule,
    OrderChatMessageModule,
    StatisticsModule,
    CustomerPointsModule,
    ExpensesModule,
    SettingsModule,
    AlertsModule,
    ReportsModule,
    // FirebaseModule,
    NotificationModule,
    CustomerModule,
    CustomerNotificationsModule,
    JenniModule,
    AiAssistantModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100000,
    }]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
// export class AppModule { }
export class AppModule implements OnModuleInit {
  constructor(private readonly adminService: AdminService) { }

  async onModuleInit() {
    await this.adminService.createDefaultAdmin();
  }
}
