import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCustomerNotificationDto } from './dto/create-customer_notification.dto';
import { UpdateCustomerNotificationDto } from './dto/update-customer_notification.dto';
import { CustomerNotification } from './entities/customer_notification.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as admin from 'firebase-admin';
import { CustomerNotificationRead } from './entities/customer-notification-read.entity';



@Injectable()
export class CustomerNotificationsService {
  constructor(
    @InjectRepository(CustomerNotification)
    private readonly notificationRepo: Repository<CustomerNotification>,

    @InjectRepository(CustomerNotificationRead)
    private readonly readRepo: Repository<CustomerNotificationRead>,

  ) { }
  private customersMessaging() {
    return admin.app('customers').messaging();
  }

  async create(dto: CreateCustomerNotificationDto) {
    const notification = await this.notificationRepo.save({
      ...dto,
      sentAt: new Date(),
    });

    // إرسال FCM Topic
    await this.sendToCustomerTopic(
      'customers_all',
      notification.title,
      notification.body,
      { notificationId: notification.id.toString() },
    );

    return notification;
  }



  async findForCustomer(
    customerId: string,
    customerCreatedAt: Date,
    page = 1,
    limit = 10,
  ) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await this.notificationRepo
      .createQueryBuilder('n')
      .leftJoin(
        'n.reads',
        'r',
        `
      r.customerId = :customerId
      AND r.isDeleted = false
      `,
        { customerId },
      )
      // 🔐 لا تجلب إشعارات أقدم من تسجيل المستخدم
      .where('n.sentAt >= :createdAt', {
        createdAt: customerCreatedAt,
      })
      .select([
        'n.id',
        'n.title',
        'n.body',
        'n.type',
        'n.sentAt',
        'r.isRead',
        'r.readAt',
      ])
      .orderBy('n.sentAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const formattedData = notifications.map(n => {
      const read = (n as any).reads?.[0];

      return {
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        sentAt: n.sentAt,
        isRead: read?.isRead ?? false,
        readAt: read?.readAt ?? null,
      };
    });

    return {
      data: formattedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }




  async getNotification(customerId: string, notificationId: number) {
    // جلب الإشعار مع حالة القراءة للعميل
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
      relations: ['reads', 'reads.customer'],
    });


    if (!notification) {
      throw new NotFoundException('الإشعار غير موجود');
    }

    // تحقق إذا هذا العميل قرأ الإشعار
    const readRecord = notification.reads.find(read => read.customer.id === customerId);

    return {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      data: notification.data,
      sentAt: notification.sentAt,
      isRead: readRecord ? readRecord.isRead : false,
      readAt: readRecord ? readRecord.readAt : null,
    };

  }

  /**
  * تعليم إشعار كمقروء للعميل
  */
  async markAsRead(customerId: string, notificationId: number) {
    // تحقق إذا سجل القراءة موجود مسبقاً
    let read = await this.readRepo.findOne({
      where: { customer: { id: customerId }, notification: { id: notificationId } },
      relations: ['customer', 'notification'],
    });

    if (!read) {
      // إنشاء سجل جديد إذا لم يكن موجود
      read = this.readRepo.create({
        customer: { id: customerId },
        notification: { id: notificationId },
        isRead: true,
        readAt: new Date(),
      });
    } else {
      // تحديث حالة القراءة
      read.isRead = true;
      read.readAt = new Date();
    }

    await this.readRepo.save(read);

    return { message: 'تم تعليم الإشعار كمقروء' };
  }




  async markAllAsRead(customerId: string) {
    // جلب كل الإشعارات التي لم يتم تسجيلها كمقروءة لهذا العميل
    const unreadNotifications = await this.notificationRepo
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.reads', 'read', 'read.customerId = :customerId', { customerId })
      .where('read.id IS NULL OR read.isRead = false')
      .getMany();

    for (const notification of unreadNotifications) {
      // تحقق إذا سجل القراءة موجود
      let read = await this.readRepo.findOne({
        where: { customer: { id: customerId }, notification: { id: notification.id } },
        relations: ['customer', 'notification'],
      });

      if (!read) {
        read = this.readRepo.create({
          customer: { id: customerId },
          notification: { id: notification.id },
          isRead: true,
          readAt: new Date(),
        });
      } else {
        read.isRead = true;
        read.readAt = new Date();
      }

      await this.readRepo.save(read);
    }

    return { message: 'تم تعليم كل الإشعارات كمقروءة' };
  }




  async deleteNotificationForCustomer(customerId: string, notificationId: number) {
    const read = await this.readRepo.findOne({
      where: { customer: { id: customerId }, notification: { id: notificationId } },
    });

    if (!read) {
      throw new NotFoundException('الإشعار غير موجود للعميل');
    }

    read.isDeleted = true;
    await this.readRepo.save(read);

    return { message: 'تم حذف الإشعار من إشعاراتك' };
  }


  private async sendToCustomerTopic(
    topic: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    await this.customersMessaging().send({
      topic,
      notification: { title, body },
      data: data ?? {},
    });
  }

  async findAllForAdmin(page = 1, limit = 10) {
    const [data, total] = await this.notificationRepo.findAndCount({
      order: { sentAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        total,                  // إجمالي الإشعارات
        page,                   // الصفحة الحالية
        limit,                  // عدد الإشعارات بالصفحة
        totalPages: Math.ceil(total / limit), // عدد الصفحات الكلي
      },
    };
  }

  async deleteNotification(notificationId: number) {
    // تحقق إذا الإشعار موجود
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('الإشعار غير موجود');
    }

    // الحذف سيحذف تلقائياً كل القراءات المرتبطة بسبب ON DELETE CASCADE
    await this.notificationRepo.delete(notificationId);

    return { message: 'تم حذف الإشعار بنجاح' };
  }


  async deleteMultipleNotifications(ids: number[]) {
    if (!ids || !ids.length) {
      throw new Error('يجب تمرير قائمة بالإشعارات للحذف');
    }

    // الحذف سيحذف تلقائياً كل القراءات المرتبطة
    const result = await this.notificationRepo
      .createQueryBuilder()
      .delete()
      .whereInIds(ids)
      .execute();

    return {
      message: `تم حذف ${result.affected} إشعار/إشعارات بنجاح`,
    };
  }


}
