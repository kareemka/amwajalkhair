// import { Injectable } from '@nestjs/common';
// import * as admin from 'firebase-admin';
// import { OrderNotification } from './entities/order-notification.entity';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';

// @Injectable()
// export class NotificationService {

//   constructor(
//     @InjectRepository(OrderNotification)
//     private readonly notificationRepo: Repository<OrderNotification>,
//   ) { }

//   async sendToTokens(
//     tokens: string[],
//     title: string,
//     body: string,
//     data?: Record<string, string>,
//   ) {
//     if (!tokens.length) return;

//     await admin.messaging().sendEachForMulticast({
//       tokens,
//       notification: {
//         title,
//         body,
//       },
//       data: data ?? {},
//     });
//   }



//   // 📥 جلب إشعارات الموظف مع Pagination
//   async findEmployeeNotifications(
//     employeeId: string,
//     page = 1,
//     limit = 10,
//   ) {
//     const [data, total] = await this.notificationRepo.findAndCount({
//       where: {
//         employee: { id: employeeId },
//       },
//       relations: ['order'],
//       order: {
//         createdAt: 'DESC',
//       },
//       skip: (page - 1) * limit,
//       take: limit,
//     });

//     return {
//       data,
//       meta: {
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit),
//       },
//     };
//   }

//   // ✅ تعليم كل الإشعارات كمقروءة
//   async markAllAsRead(employeeId: number) {
//     await this.notificationRepo
//       .createQueryBuilder()
//       .update(OrderNotification)
//       .set({ isRead: true })
//       .where('employeeId = :employeeId', { employeeId })
//       .andWhere('isRead = false')
//       .execute();

//     return { message: 'تم تعليم جميع الإشعارات كمقروءة' };
//   }

// }




import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { OrderNotification } from './entities/order-notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeService } from 'src/employee/employee.service';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(OrderNotification)
    private readonly notificationRepo: Repository<OrderNotification>,
    private readonly employeeService: EmployeeService,
  ) { }

  // =========================
  // 🔵 Firebase Apps
  // =========================
  private employeesMessaging() {
    return admin.app('employees').messaging();
  }

  // private customersMessaging() {
  //   return admin.app('customers').messaging();
  // }

  // =========================
  // 🔔 إرسال Tokens للموظفين
  // =========================
  async sendToEmployeeTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!tokens?.length) return;

    const chunkSize = 500;

    for (let i = 0; i < tokens.length; i += chunkSize) {
      const chunk = tokens.slice(i, i + chunkSize);

      const response = await this.employeesMessaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data: data ?? {},
      });

      console.log('FCM success:', response.successCount);
      console.log('FCM failure:', response.failureCount);

      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error('❌ FCM failed token:', chunk[idx]);
          console.error('❌ Error code:', resp.error?.code);
          console.error('❌ Error message:', resp.error?.message);
        }
      });


      if (response.failureCount > 0) {
        const failedTokens: string[] = [];

        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            const error = resp.error;

            if (
              error.code === 'messaging/registration-token-not-registered' ||
              error.code === 'messaging/invalid-registration-token'
            ) {
              failedTokens.push(chunk[idx]);
            }
          }
        });

        if (failedTokens.length) {
          await Promise.all(
            failedTokens.map(token =>
              this.employeeService.removeFcmToken(null, token)
            )
          );
        }
      }
    }
  }

  // =========================
  // 🔔 إرسال Tokens للعملاء
  // =========================
  // async sendToCustomerTokens(
  //   tokens: string[],
  //   title: string,
  //   body: string,
  //   data?: Record<string, string>,
  // ) {
  //   if (!tokens?.length) return;

  //   await this.customersMessaging().sendEachForMulticast({
  //     tokens,
  //     notification: { title, body },
  //     data: data ?? {},
  //   });
  // }

  // =========================
  // 📣 Topic للموظفين
  // =========================
  async sendToEmployeeTopic(
    topic: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    await this.employeesMessaging().send({
      topic,
      notification: { title, body },
      data: data ?? {},
    });
  }

  // =========================
  // 📣 Topic للعملاء
  // =========================
  // async sendToCustomerTopic(
  //   topic: string,
  //   title: string,
  //   body: string,
  //   data?: Record<string, string>,
  // ) {
  //   await this.customersMessaging().send({
  //     topic,
  //     notification: { title, body },
  //     data: data ?? {},
  //   });
  // }

  // =========================
  // 📥 إشعارات الموظف (كما هي)
  // =========================
  async findEmployeeNotifications(
    employeeId: string,
    page = 1,
    limit = 10,
  ) {
    const [data, total] = await this.notificationRepo.findAndCount({
      where: { employee: { id: employeeId } },
      relations: ['order'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =========================
  // ✅ تعليم الكل كمقروء
  // =========================
  async markAllAsRead(employeeId: number) {
    await this.notificationRepo
      .createQueryBuilder()
      .update(OrderNotification)
      .set({ isRead: true })
      .where('employeeId = :employeeId', { employeeId })
      .andWhere('isRead = false')
      .execute();

    return { message: 'تم تعليم جميع الإشعارات كمقروءة' };
  }

  // =========================
  // 🗑️ تصفير كل إشعارات النظام
  // =========================
  async clearAllNotifications() {
    await this.notificationRepo.createQueryBuilder().delete().execute();
    return { message: 'تم تصفير جميع إشعارات النظام بنجاح' };
  }
}
