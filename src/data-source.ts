// src/data-source/AppDataSource.ts
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { CustomerPoint } from './customer-points/entities/customer-point.entity';
import { Employee } from './employee/entities/employee.entity';
import { OrderItem } from './order-item/entities/order-item.entity';
import { Order } from './order/entities/order.entity';
import { Product } from './product/entities/product.entity';
import { Admin } from './admin/entities/admin.entity';
import { Alert } from './alerts/entities/alert.entity';
import { Expense } from './expenses/entities/expense.entity';
import { OrderNotification } from './notification/entities/order-notification.entity';
import { OrderChatMessage } from './order_chat_message/entities/order_chat_message.entity';
import { OrderStatusLog } from './order-status-log/entities/order-status-log.entity';
import { Setting } from './settings/entities/setting.entity';
import { EmployeeAlert } from './alerts/entities/employee-alert.entity';
import { CustomerNotification } from './customer_notifications/entities/customer_notification.entity';
import { CustomerNotificationRead } from './customer_notifications/entities/customer-notification-read.entity';
import { Customer } from './customer/entities/customer.entity';
import { ProductImage } from './product/entities/product-image.entity';

// ------------------ استيراد الإنتيتيس ------------------



// ------------------ تحميل متغيرات البيئة ------------------
dotenv.config();

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [
        Admin,
        Alert,
        CustomerPoint,
        Employee,
        Expense,
        OrderNotification,
        Order,
        OrderChatMessage,
        OrderItem,
        OrderStatusLog,
        Product,
        ProductImage,
        Setting,
        EmployeeAlert,
        // customer 
        Customer,
        CustomerNotification,
        CustomerNotificationRead,


    ],
    migrations: ['src/migrations/*.ts'], // مكان الميجريشنز
    synchronize: false, // ❌ لا تستخدمه في الإنتاج
});
