import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource, Not, Like, Between } from 'typeorm';
import { Order } from './entities/order.entity';
import { EmployeeService } from '../employee/employee.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Product } from 'src/product/entities/product.entity';
import { OrderStatus } from 'src/utils/order-status.enum';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument as PDFLibDocument } from "pdf-lib";


import Handlebars from "handlebars";
import { chromium } from "playwright";
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderStatusLog } from 'src/order-status-log/entities/order-status-log.entity';

import * as ExcelJS from 'exceljs';
import { NotificationService } from 'src/notification/notification.service';
import { OrderNotification } from 'src/notification/entities/order-notification.entity';
import { getOrderNotificationMessage } from 'src/utils/get-order-notification-message';
import { OrderItem } from 'src/order-item/entities/order-item.entity';
import { Setting } from 'src/settings/entities/setting.entity';
import { CreateCustomerOrderDto } from 'src/customer/dto/create-customer-order.dto';
import { Customer } from 'src/customer/entities/customer.entity';
import { OrderSource } from 'src/utils/enums';
import { JenniService } from 'src/jenni/jenni.service';
import { forwardRef, Inject } from '@nestjs/common';


@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    private employeeService: EmployeeService,
    private notificationService: NotificationService,

    @InjectRepository(Product)
    private productRepo: Repository<Product>,

    @InjectRepository(OrderStatusLog)
    private orderStatusLogRepo: Repository<OrderStatusLog>,

    @InjectRepository(OrderNotification)
    private orderNotificationRepo: Repository<OrderNotification>,

    @InjectRepository(OrderItem)
    private orderItemRepo: Repository<OrderItem>,

    @InjectRepository(Setting)
    private settingRepo: Repository<Setting>,

    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,

    private dataSource: DataSource,

    @Inject(forwardRef(() => JenniService))
    private jenniService: JenniService

  ) { }

  async create(createOrderDto: CreateOrderDto, employeeId: string) {
    const { items, ...orderData } = createOrderDto;
    // تم تفريغ createdAt من الطلب حتى لا يعتمد النظام على وقت التطبيق القديم
    // 1️⃣ جلب الموظف
    const employee = await this.employeeService.findOne(employeeId);

    // 2️⃣ جلب كل المنتجات المطلوبة
    const productCodes = items.map(i => i.productCode);
    const products = await this.productRepo.find({
      where: { code: In(productCodes) },
    });

    // 3️⃣ التحقق من الكميات قبل الخصم
    for (const item of items) {
      const product = products.find(p => p.code === item.productCode);

      if (!product)
        throw new BadRequestException(`المنتج ${item.productCode} غير موجود`);

      if (product.quantity < item.quantity)
        throw new BadRequestException(`الكمية غير كافية للمنتج: ${product.name}`);
    }

    // 4️⃣ تقليل الكميات في المخزن
    for (const item of items) {
      const product = products.find(p => p.code === item.productCode);
      product.quantity -= item.quantity;
      await this.productRepo.save(product);
    }

    // 5️⃣ توليد رقم الطلب تلقائيًا إذا لم يُرسل
    if (!orderData.orderNumber) {
      let nextNumber = (await this.orderRepo.count()) + 1;

      while (await this.orderRepo.findOne({ where: { orderNumber: nextNumber } })) {
        nextNumber++;
      }

      orderData.orderNumber = nextNumber;
    }

    // 6️⃣ إنشاء الطلب مع Snapshot لكل عنصر
    const order = this.orderRepo.create({
      ...orderData,
      statusUpdatedAt: new Date(), // 👈 تهيئة وقت تحديث الحالة عند الإنشاء
      employee,
      totalAmount: orderData.totalAmount || 0,
      items: items.map(item => {
        const product = products.find(p => p.code === item.productCode);

        return this.orderItemRepo.create({
          product,                    // optional، موجود لو المنتج ما انحذف
          productName: product.name,  // snapshot
          productCode: product.code,  // snapshot
          cc: product.cc,   // snapshot
          quantity: item.quantity,
        });
      }),
    });



    // 7️⃣ حفظ الطلب
    return this.orderRepo.save(order);
  }


  async createByCustomer(
    customerId: string,
    dto: CreateCustomerOrderDto,
  ) {
    const { items, ...customerData } = dto;

    // 1️⃣ جلب الزبون مع الموظف
    const customer = await this.customerRepo.findOne({
      where: { id: customerId },
      relations: ['employee'],
    });

    if (!customer)
      throw new BadRequestException('الزبون غير موجود');

    if (customer.isBlocked)
      throw new ForbiddenException('حسابك موقوف');

    // 2️⃣ جلب المنتجات
    const productCodes = items.map(i => i.productCode);
    const products = await this.productRepo.find({
      where: { code: In(productCodes) },
    });

    let totalAmount = 0; // ✅ المجموع الكلي

    // 3️⃣ التحقق من الكميات + حساب المجموع
    for (const item of items) {
      const product = products.find(p => p.code === item.productCode);

      if (!product)
        throw new BadRequestException(`المنتج ${item.productCode} غير موجود`);

      if (product.quantity < item.quantity)
        throw new BadRequestException(`الكمية غير كافية للمنتج: ${product.name}`);

      const unitPrice = product.salePrice ?? product.price;
      totalAmount += unitPrice * item.quantity;
    }

    // 4️⃣ خصم الكميات من المخزون
    for (const item of items) {
      const product = products.find(p => p.code === item.productCode);
      product.quantity -= item.quantity;
      await this.productRepo.save(product);
    }


    let nextNumber = (await this.orderRepo.count()) + 1;

    while (await this.orderRepo.findOne({ where: { orderNumber: nextNumber } })) {
      nextNumber++;
    }

    const orderNumber = nextNumber;

    // 5️⃣ إنشاء الطلب
    const order = this.orderRepo.create({
      orderNumber,
      employee: customer.employee,
      customerName: customer.name,
      customerPhone: customerData.customerPhone,
      customerPhone2: customerData.customerPhone2,
      whatsappNumber: customerData.whatsappNumber,
      governorate: customerData.governorate,
      district: customerData.district,
      area: customerData.area,
      marketerName: customer.employee.name,
      notes: customerData.notes,
      totalAmount, // ✅ المحسوب تلقائيًا
      source: OrderSource.STORE_APP,
      statusUpdatedAt: new Date(), // 👈 تهيئة وقت تحديث الحالة
      items: items.map(item => {
        const product = products.find(p => p.code === item.productCode);
        const unitPrice = product.salePrice ?? product.price;

        return this.orderItemRepo.create({
          product,
          productName: product.name,
          productCode: product.code,
          cc: product.cc,
          quantity: item.quantity,
          price: unitPrice,
        });
      }),
    });

    return this.orderRepo.save(order);
  }

  async createPublic(dto: CreateOrderDto) {
    const { items, ...orderData } = dto;
    // 👈 تجاوز الوقت المرسل من التطبيق القديم مع السماح بمروره
    // 1️⃣ البحث عن الموظف عبر كود الإحالة (إذا وجد)، وإلا تعيين الموظف الرئيسي (هافانا)
    let employee = null;
    if (orderData.marketerName) {
      employee = await this.employeeService.findByReferralCode(orderData.marketerName);
    }

    // إذا لم يأتِ من رابط إحالة أو لم يتم العثور على الموظف، نربطه بالموظف الرئيسي (مثلاً havana)
    if (!employee) {
      employee = await this.employeeService.findByUsername('هافانا'); // Username for the main employee
    }

    // 2️⃣ جلب المنتجات
    const productCodes = items.map(i => i.productCode);
    const products = await this.productRepo.find({
      where: { code: In(productCodes) },
    });

    // 3️⃣ التحقق من الكميات
    for (const item of items) {
      const product = products.find(p => p.code === item.productCode);
      if (!product)
        throw new BadRequestException(`المنتج ${item.productCode} غير موجود`);

      if (product.quantity < item.quantity)
        throw new BadRequestException(`الكمية غير كافية للمنتج: ${product.name}`);
    }

    // 4️⃣ خصم الكميات واحتساب المجموع الحقيقي
    let calculatedTotal = 0;
    for (const item of items) {
      const product = products.find(p => p.code === item.productCode);
      product.quantity -= item.quantity;
      await this.productRepo.save(product);

      // احتساب السعر الفعلي للمنتج وقت الطلب
      const effectivePrice = (product.salePrice && product.salePrice > 0) ? product.salePrice : product.price;
      calculatedTotal += effectivePrice * item.quantity;
    }

    // 5️⃣ توليد رقم الطلب
    let nextNumber = (await this.orderRepo.count()) + 1;
    while (await this.orderRepo.findOne({ where: { orderNumber: nextNumber } })) {
      nextNumber++;
    }

    // 6️⃣ إنشاء الطلب
    const order = this.orderRepo.create({
      ...orderData,
      statusUpdatedAt: new Date(), // 👈 تهيئة وقت تحديث الحالة
      totalAmount: calculatedTotal, // استخدام المجموع المحسوب برمجياً للحماية
      orderNumber: nextNumber,
      employee, // ربط الطلب بالموظف (Leader)
      source: OrderSource.STORE_WEBSITE,
      items: items.map(item => {
        const product = products.find(p => p.code === item.productCode);
        const effectivePrice = (product.salePrice && product.salePrice > 0) ? product.salePrice : product.price;
        return this.orderItemRepo.create({
          product,
          productName: product.name,
          productCode: product.code,
          cc: product.cc,
          quantity: item.quantity,
          price: effectivePrice, // أرشفة السعر وقت الطلب
        });
      }),
    });

    return this.orderRepo.save(order);
  }




  async getOrderDetails(orderId: number) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['employee', 'items', 'items.product', 'statusLogs'],
      order: { statusLogs: { createdAt: 'DESC' } },
    });

    if (!order) {
      throw new NotFoundException('الطلب غير موجود');
    }

    const formattedItems = order.items.map(item => ({
      id: item.id,
      quantity: item.quantity,
      cc: item.cc,
      productName: item.productName,
      productCode: item.productCode,
      productExists: !!item.product,
    }));

    // جلب سعر التوصيل من جدول Setting
    const setting = await this.settingRepo.findOne({ where: {} });
    const deliveryPrice = setting ? setting.deliveryPrice : 0;
    return {
      ...order,
      items: formattedItems,
      deliveryPrice,
    };
  }




  async getOrdersForDashboard(
    employeeId: string,
    status?: OrderStatus | string,
    page: number = 1,
    limit: number = 10,
  ) {
    const where: any = {};

    if (employeeId !== 'system-root') {
      // 🔥 دائمًا نجيب كل الهرم
      const ids = await this.employeeService.getEmployeeTreeIds(employeeId);
      where.employee = { id: In(ids) };
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await this.orderRepo.findAndCount({
      where,
      relations: ['employee', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: orders,
      total,
      page,
      limit,
      lastPage: Math.ceil(total / limit),
    };
  }


  //  تعلق موقت 
  // async getOrdersForDashboard(
  //   employeeId: string,
  //   status?: OrderStatus,
  //   page: number = 1,
  //   limit: number = 10,
  // ) {
  //   const where: any = {};

  //   if (employeeId !== 'system-root') {
  //     let ids: string[] = [];
  //     // UNCONFIRMED → فقط الموظف نفسه
  //     if (status === OrderStatus.UNCONFIRMED) {
  //       ids = [employeeId];
  //     } else {
  //       ids = await this.employeeService.getEmployeeTreeIds(employeeId);
  //     }
  //     where.employee = { id: In(ids) };
  //   }

  //   if (status) {
  //     where.status = status;
  //   }

  //   const skip = (page - 1) * limit;

  //   const [orders, total] = await this.orderRepo.findAndCount({
  //     where,
  //     relations: ['employee', 'items', 'items.product'],
  //     order: { createdAt: 'DESC' },
  //     skip,
  //     take: limit,
  //   });

  //   return {
  //     data: orders,
  //     total,
  //     page,
  //     limit,
  //     lastPage: Math.ceil(total / limit),
  //   };
  // }




  async getGlobalDashboardStats() {
    // 1) جلب كل الطلبات (لإحصائيات الحالات والمبالغ)
    const orders = await this.orderRepo.find({
      select: ['status', 'totalAmount', 'createdAt'],
    });

    // 2) جلب آخر 5 طلبات حديثة
    const latestOrders = await this.orderRepo.find({
      relations: ['employee', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
      take: 5,
    });

    // 3) تهيئة العدّادات
    const counts: Record<OrderStatus | 'TOTAL', number> = {
      UNCONFIRMED: 0,
      REJECTED: 0,
      DELIVERING: 0,
      PROCESSING: 0,
      RETURNED: 0,
      DELIVERED: 0,
      ARCHIVED_RETURNED: 0,
      ARCHIVED_DELIVERED: 0,
      TOTAL: orders.length,
    };

    // 4) حساب مجموع المبالغ والطلبات اليومية
    let totalAmount = 0;
    let dailyOrdersCount = 0;

    // حساب بداية اليوم بتوقيت العراق
    const now = new Date();
    const iraqNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const startOfTodayIraq = new Date(iraqNow);
    startOfTodayIraq.setHours(0, 0, 0, 0);

    // تحويله للـ UTC للمقارنة مع قاعدة البيانات
    const startOfTodayUtc = new Date(startOfTodayIraq.getTime() - 3 * 60 * 60 * 1000);

    for (const order of orders) {
      counts[order.status] += 1;
      totalAmount += order.totalAmount || 0;

      if (order.createdAt >= startOfTodayUtc) {
        dailyOrdersCount += 1;
      }
    }

    // 5) حساب معدل التسليم
    const deliveredCount = counts.DELIVERED + counts.ARCHIVED_DELIVERED;

    const deliveryRate =
      counts.TOTAL > 0
        ? Number(((deliveredCount / counts.TOTAL) * 100).toFixed(2))
        : 0;

    // 6) إرجاع النتائج
    return {
      counts,
      totalAmount,
      deliveryRate,
      latestOrders,
      dailyOrdersCount,
    };
  }



  async getOrdersByEmployeeHierarchy(
    employeeId: string,
    status?: OrderStatus | string,
    page: number = 1,
    limit: number = 10,
  ) {
    const ids = await this.employeeService.getEmployeeTreeIds(employeeId);

    const skip = (page - 1) * limit;

    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.employee', 'employee')
      .leftJoinAndSelect('order.statusLogs', 'log')
      .where('employee.id IN (:...ids)', { ids });

    if (status && status !== 'ALL') {
      qb.andWhere('order.status = :status', { status });
    }

    // 👇 الترتيب حسب احدث تبليغ
    if (
      status === OrderStatus.PROCESSING || status === 'PROCESSING'
    ) {
      qb.orderBy('log.createdAt', 'DESC'); // حسب أحدث تبليغ
    } else {
      qb.orderBy('order.createdAt', 'DESC');
    }

    const [orders, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: orders,
      total,
      page,
      limit,
      lastPage: Math.ceil(total / limit),
    };
  }




  //  وقفناه لانه في قيد المعالجة او تبليغ يظهر اعلى حسب رقم الطلب الكبير وليس حسب الطلب صاحب احدث تبليغ
  // async getOrdersByEmployeeHierarchy(
  //   employeeId: string,
  //   status?: OrderStatus,
  //   page: number = 1,
  //   limit: number = 10,
  // ) {
  //   // دائمًا نجيب كل الهرم
  //   const ids = await this.employeeService.getEmployeeTreeIds(employeeId);

  //   const where: any = {
  //     employee: { id: In(ids) },
  //   };

  //   if (status) {
  //     where.status = status;
  //   }

  //   const skip = (page - 1) * limit;

  //   const [orders, total] = await this.orderRepo.findAndCount({
  //     where,
  //     relations: ['employee'],
  //     order: { createdAt: 'DESC' },
  //     skip,
  //     take: limit,
  //   });

  //   return {
  //     data: orders,
  //     total,
  //     page,
  //     limit,
  //     lastPage: Math.ceil(total / limit),
  //   };
  // }

  //   هذا وقفناه لانه اللى اعلى من الموظف لايظهر له الطلب غير الموكد 
  // async getOrdersByEmployeeHierarchy(
  //   employeeId: string,
  //   status?: OrderStatus,
  //   page: number = 1,
  //   limit: number = 10,
  // ) {
  //   let ids: string[] = [];

  //   if (status === OrderStatus.UNCONFIRMED) {
  //     // فقط الموظف نفسه
  //     ids = [employeeId];
  //   } else {
  //     // كامل الهرم
  //     ids = await this.employeeService.getEmployeeTreeIds(employeeId);
  //   }

  //   const where: any = {
  //     employee: { id: In(ids) },
  //   };

  //   // إذا أرسل status نضيفها للبحث
  //   if (status) {
  //     where.status = status;
  //   }

  //   const skip = (page - 1) * limit;

  //   const [orders, total] = await this.orderRepo.findAndCount({
  //     where,
  //     relations: ['employee'],
  //     order: { createdAt: 'DESC' },
  //     skip,
  //     take: limit,
  //   });

  //   return {
  //     data: orders,
  //     total,
  //     page,
  //     limit,
  //     lastPage: Math.ceil(total / limit),
  //   };
  // }






  async updateOrderStatusByOrderNumber(
    orderNumber: number,
    newStatus: OrderStatus,
    message?: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1) جلب الطلب
      const order = await queryRunner.manager.findOne(Order, {
        where: { orderNumber },
        relations: ['employee', 'items', 'items.product'],
      });

      if (!order) throw new Error(`الطلب غير موجود: ${orderNumber}`);

      const oldStatus = order.status;

      // 🔥 تجاهل DELIVERING بالكامل
      if (newStatus === OrderStatus.DELIVERING) {
        this.logger.log(`Ignoring DELIVERING for order ${orderNumber}`);
        await queryRunner.rollbackTransaction();
        return;
      }

      // 🔥 منع التكرار
      if (oldStatus === newStatus) {
        await queryRunner.rollbackTransaction();
        return;
      }

      // 2) إرجاع الكمية فقط عند RETURNED
      if (
        newStatus === OrderStatus.RETURNED &&
        oldStatus !== OrderStatus.RETURNED
      ) {
        for (const item of order.items) {
          await queryRunner.manager.increment(
            Product,
            { code: item.product.code },
            "quantity",
            item.quantity
          );
        }
      }

      // 3) تحديث الحالة
      order.status = newStatus;
      order.statusUpdatedAt = new Date();
      await queryRunner.manager.save(order);

      // 4) تسجيل التبليغ فقط في PROCESSING
      let orderAlert = null;

      if (newStatus === OrderStatus.PROCESSING) {
        if (!message?.trim()) {
          throw new Error("رسالة التبليغ مطلوبة لحالة PROCESSING");
        }

        orderAlert = this.orderStatusLogRepo.create({
          order,
          status: newStatus,
          message: message.trim(),
        });

        await queryRunner.manager.save(orderAlert);
      }

      // 5) حفظ الإشعارات في DB داخل Transaction
      const recipients = await this.saveHierarchyNotificationsToDb(
        queryRunner,
        order,
        newStatus,
        message,
      );

      await queryRunner.commitTransaction();

      // 6) إرسال FCM بعد النجاح - fire & forget (لا يؤثر على الـ transaction)
      this.sendFcmToAll(order, newStatus, message, recipients).catch(err =>
        this.logger.warn(`FCM send failed (non-critical): ${err.message}`)
      );

      return {
        message: "تم تحديث حالة الطلب",
        order,
        notification: orderAlert,
      };

    } catch (error: any) {
      this.logger.error(
        `Error updating order ${orderNumber}: ${error.message}`,
        error.stack
      );

      if (queryRunner?.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      throw new Error(error.message);
    } finally {
      await queryRunner.release();
    }
  }




  async updateOrderStatus(
    orderId: number,
    newStatus: OrderStatus,
    message?: string,   // ⬅️ ممكن null أو undefined
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1) جلب الطلب (محاولة بالـ ID أولاً، ثم بالـ orderNumber)
      let order = await queryRunner.manager.findOne(Order, {
        where: { id: orderId },
        relations: ['employee', 'items', 'items.product'],
      });

      if (!order) {
        order = await queryRunner.manager.findOne(Order, {
          where: { orderNumber: orderId },
          relations: ['employee', 'items', 'items.product'],
        });
      }

      if (!order) throw new Error("الطلب غير موجود");

      const oldStatus = order.status;

      // 2) إرجاع الكمية إذا الحالة الجديدة (راجع أو مرفوض)
      const shouldReturnQty =
        newStatus === OrderStatus.REJECTED ||
        newStatus === OrderStatus.RETURNED;

      if (shouldReturnQty) {
        if (
          oldStatus !== OrderStatus.REJECTED &&
          oldStatus !== OrderStatus.RETURNED
        ) {
          for (const item of order.items) {
            await queryRunner.manager.increment(
              Product,
              { code: item.product.code },
              "quantity",
              item.quantity
            );
          }
        }
      }

      // 3) تحديث الحالة
      order.status = newStatus;
      order.statusUpdatedAt = new Date();
      await queryRunner.manager.save(order);

      // 4) تسجيل التبليغ فقط في حالة PROCESSING
      let orderAlert = null;

      if (newStatus === OrderStatus.PROCESSING) {
        // ❗ تأكد من وجود رسالة
        if (!message || message.trim() === "") {
          throw new Error("يجب كتابة رسالة التبليغ عند اختيار حالة تبليغ/معالجة");
        }

        orderAlert = this.orderStatusLogRepo.create({
          order,
          status: newStatus,
          message: message.trim(),
        });

        await queryRunner.manager.save(orderAlert);
      }



      // حفظ الإشعارات في DB داخل Transaction
      const recipients = await this.saveHierarchyNotificationsToDb(
        queryRunner,
        order,
        newStatus,
        message,
      );

      await queryRunner.commitTransaction();

      // إرسال FCM بعد النجاح - fire & forget
      this.sendFcmToAll(order, newStatus, message, recipients).catch(err =>
        this.logger.warn(`FCM send failed (non-critical): ${err.message}`)
      );

      if (newStatus === OrderStatus.DELIVERING) {
        // await this.jenniService.createShipment(order);
      }

      return {
        message: "تم تحديث حالة الطلب",
        order,
        notification: orderAlert,
      };

    } catch (error: any) {
      this.logger.error(`Error updating order ${orderId}: ${error.message}`, error.stack);
      if (queryRunner?.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw new Error(error.message);
    } finally {
      await queryRunner.release();
    }
  }



  async updateMultipleOrderStatus(
    orderIds: number[],
    newStatus: OrderStatus,
    message?: string, // ممكن null أو undefined
  ) {
    if (!orderIds || orderIds.length === 0) {
      throw new Error("يرجى إرسال قائمة الطلبات لتحديثها");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const updatedOrders: { order: Order; recipients: any[] }[] = [];
      const orderAlerts = [];

      for (const orderId of orderIds) {
        // 1) جلب الطلب
        const order = await queryRunner.manager.findOne(Order, {
          where: { id: orderId },
          relations: ['employee', 'items', 'items.product'],
        });

        if (!order) {
          throw new Error(`الطلب ${orderId} غير موجود`);
        }

        const oldStatus = order.status;

        // 2) إرجاع الكمية إذا الحالة الجديدة (راجع أو مرفوض)
        const shouldReturnQty =
          newStatus === OrderStatus.REJECTED ||
          newStatus === OrderStatus.RETURNED;

        if (shouldReturnQty && oldStatus !== OrderStatus.REJECTED && oldStatus !== OrderStatus.RETURNED) {
          for (const item of order.items) {
            await queryRunner.manager.increment(
              Product,
              { code: item.product.code },
              "quantity",
              item.quantity
            );
          }
        }

        // 3) تحديث الحالة
        order.status = newStatus;
        order.statusUpdatedAt = new Date();
        await queryRunner.manager.save(order);

        // 4) تسجيل التبليغ فقط في حالة PROCESSING
        let orderAlert = null;
        if (newStatus === OrderStatus.PROCESSING) {
          if (!message || message.trim() === "") {
            throw new Error(`يجب كتابة رسالة التبليغ عند اختيار حالة معالجة للطلب ${orderId}`);
          }

          orderAlert = this.orderStatusLogRepo.create({
            order,
            status: newStatus,
            message: message.trim(),
          });

          await queryRunner.manager.save(orderAlert);
          orderAlerts.push(orderAlert);
        }

        // حفظ الإشعارات في DB داخل Transaction فقط
        const r = await this.saveHierarchyNotificationsToDb(
          queryRunner,
          order,
          newStatus,
          message,
        );
        updatedOrders.push({ order, recipients: r });
      }

      await queryRunner.commitTransaction();

      // إرسال FCM بعد النجاح لكل الطلبات - fire & forget
      for (const { order: o, recipients } of updatedOrders) {
        this.sendFcmToAll(o, newStatus, message, recipients).catch(err =>
          this.logger.warn(`FCM send failed (non-critical): ${err.message}`)
        );

        if (newStatus === OrderStatus.DELIVERING) {
          // await this.jenniService.createShipment(o);
        }
      }

      return {
        message: `تم تحديث حالة ${updatedOrders.length} طلب${updatedOrders.length > 1 ? 'ات' : ''} بنجاح`,
        orders: updatedOrders.map(e => e.order),
        notifications: orderAlerts,
      };
    } catch (error: any) {
      this.logger.error(`Error updating multiple orders: ${error.message}`, error.stack);
      if (queryRunner?.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw new Error(error.message);
    } finally {
      await queryRunner.release();
    }
  }




  private async sendOrderStatusNotification(
    order: Order,
    status: OrderStatus,
    message?: string,
    recipientEmployee?: any, // إضافة خيار لتحديد المستلم (للهرم)
  ) {
    const targetEmployee = recipientEmployee || order.employee;
    if (!targetEmployee) return;

    // جلب التوكنز
    const tokens = (targetEmployee.fcmTokens ?? []).filter(Boolean);
    if (!tokens.length) return;

    const statusTextMap: Record<OrderStatus, string> = {
      UNCONFIRMED: 'غير مؤكد',
      PROCESSING: 'تبليغ او المعالجة',
      DELIVERING: 'قيد التوصيل',
      DELIVERED: 'تم التسليم',
      REJECTED: 'مرفوض',
      RETURNED: 'راجع',
      ARCHIVED_RETURNED: 'ارشيف راجع',
      ARCHIVED_DELIVERED: 'ارشيف واصل',
    };

    const statusText = statusTextMap[status] ?? status;
    const title = 'تحديث حالة الطلب';

    // النص حسب الحالة
    let body = `الطلب #${order.orderNumber || order.id} أصبح ${statusText}`;
    if (status === OrderStatus.PROCESSING && message?.trim()) {
      body += `\n📢 ${message.trim()}`;
    }

    await this.notificationService.sendToEmployeeTokens(
      tokens,
      title,
      body,
      {
        orderId: order.id.toString(),
        status,
        screen: 'order-details',
      },
    );
  }

  /**
   * ✅ حفظ الإشعارات في DB فقط (داخل Transaction) - يُرجع قائمة المستلمين لإرسال FCM لاحقاً
   */
  private async saveHierarchyNotificationsToDb(
    queryRunner: any,
    order: Order,
    status: OrderStatus,
    message?: string,
  ): Promise<any[]> {
    if (!order.employee) return [];

    const ancestors = await this.employeeService.getAncestors(order.employee.id);
    const allToNotify = [order.employee, ...ancestors];
    const orderNotifMessage = getOrderNotificationMessage(status);

    for (const emp of allToNotify) {
      const notif = this.orderNotificationRepo.create({
        order,
        status,
        employee: emp,
        title: 'تحديث حالة الطلب',
        message: status === OrderStatus.PROCESSING && message
          ? `${orderNotifMessage}: ${message}`
          : orderNotifMessage,
      });
      await queryRunner.manager.save(notif);
    }

    return allToNotify;
  }

  /**
   * 🔔 إرسال FCM لكل المستلمين - يُستدعى بعد commit (fire & forget)
   */
  private async sendFcmToAll(
    order: Order,
    status: OrderStatus,
    message: string | undefined,
    recipients: any[],
  ) {
    for (const emp of recipients) {
      await this.sendOrderStatusNotification(order, status, message, emp);
    }
  }







  async updateOrder(orderId: number, dto: UpdateOrderDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1️⃣ جلب الطلب مع العناصر
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: orderId },
        relations: ['items', 'items.product'],
      });

      if (!order) throw new NotFoundException('الطلب غير موجود');

      const oldItems = order.items;
      const newItems = dto.items;

      // 2️⃣ تحويل العناصر القديمة إلى Map
      const oldMap = new Map<string, number>();
      for (const item of oldItems) {
        if (item.product) {
          oldMap.set(item.product.code, item.quantity);
        } else {
          oldMap.set(item.productCode, item.quantity);
        }
      }

      // 3️⃣ تحويل العناصر الجديدة إلى Map
      const newMap = new Map<string, number>();
      for (const item of newItems) {
        newMap.set(item.productCode, item.quantity);
      }

      // 4️⃣ جميع أكواد المنتجات (قديم + جديد)
      const allCodes = [...new Set([...oldMap.keys(), ...newMap.keys()])];

      // 5️⃣ جلب جميع المنتجات
      const products = await queryRunner.manager.find(Product, {
        where: { code: In(allCodes) },
      });

      // 6️⃣ حساب الفرق (Delta) والتعامل مع المخزن
      for (const code of allCodes) {
        const oldQty = oldMap.get(code) ?? 0;
        const newQty = newMap.get(code) ?? 0;
        const delta = newQty - oldQty;

        if (delta === 0) continue;

        const product = products.find(p => p.code === code);

        // إذا المنتج محذوف، لا نخصم من المخزن
        if (!product) continue;

        // ➕ زيادة بالطلب → خصم من المخزن
        if (delta > 0) {
          if (product.quantity < delta) {
            throw new BadRequestException(
              `الكمية غير كافية للمنتج: ${product.name}`,
            );
          }
          await queryRunner.manager.decrement(Product, { code }, 'quantity', delta);
        }

        // ➖ تقليل بالطلب → إرجاع للمخزن
        if (delta < 0) {
          await queryRunner.manager.increment(Product, { code }, 'quantity', Math.abs(delta));
        }
      }

      // 7️⃣ تحديث بيانات الطلب العامة
      if (dto.status && dto.status !== order.status) {
        order.statusUpdatedAt = new Date();
      }

      Object.assign(order, {
        customerName: dto.customerName ?? order.customerName,
        marketerName: dto.marketerName ?? order.marketerName,
        customerPhone: dto.customerPhone ?? order.customerPhone,
        customerPhone2: dto.customerPhone2 ?? order.customerPhone2,
        whatsappNumber: dto.whatsappNumber ?? order.whatsappNumber,
        governorate: dto.governorate ?? order.governorate,
        district: dto.district ?? order.district,
        area: dto.area ?? order.area,
        notes: dto.notes ?? order.notes,
        status: dto.status ?? order.status,
        totalAmount: dto.totalAmount ?? order.totalAmount,
      });

      // 8️⃣ التحقق من رقم الطلب
      if (dto.orderNumber !== undefined && dto.orderNumber !== null) {
        const exists = await queryRunner.manager.findOne(Order, {
          where: { orderNumber: dto.orderNumber, id: Not(orderId) },
        });

        if (exists)
          throw new ConflictException(`رقم الطلب ${dto.orderNumber} مستخدم مسبقاً`);

        order.orderNumber = dto.orderNumber;
      }

      // 9️⃣ حذف العناصر القديمة
      await queryRunner.manager.delete(OrderItem, { order: { id: orderId } });

      // 🔟 إضافة العناصر الجديدة مع Snapshot
      order.items = newItems.map(item => {
        const product = products.find(p => p.code === item.productCode);

        return queryRunner.manager.create(OrderItem, {
          product,                    // optional
          productName: product.name,  // snapshot
          productCode: product.code,  // snapshot
          cc: product.cc,   // snapshot
          quantity: item.quantity,
          order,
        });
      });

      // 1️⃣2️⃣ حفظ الطلب
      await queryRunner.manager.save(order);
      await queryRunner.commitTransaction();

      return order;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }






  // async findPaginatedForAdmin(page: number = 1, limit: number = 10) {
  //   const skip = (page - 1) * limit;

  //   const [data, total] = await this.orderRepo.findAndCount({
  //     relations: ['employee', 'items', 'items.product'],
  //     skip,
  //     take: limit,
  //     order: { createdAt: 'DESC' },
  //   });

  //   return {
  //     page,
  //     limit,
  //     total,
  //     totalPages: Math.ceil(total / limit),
  //     data,
  //   };
  // }




  async findPaginatedForAdmin(
    page: number = 1,
    limit: number = 10,
    status?: OrderStatus | string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    // 👇 إذا أُرسلت الحالة فقط نفلتر
    if (status === 'TODAYS_ORDERS') {
      where.status = OrderStatus.DELIVERING;

      // 1. وقت السيرفر الحالي
      const now = new Date();

      // نحول لتوقيت العراق
      const iraqNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);

      // نحسب بداية ونهاية اليوم بالعراق
      const start = new Date(iraqNow);
      start.setHours(0, 0, 0, 0);

      const end = new Date(iraqNow);
      end.setHours(23, 59, 59, 999);

      // نرجعهم UTC
      const utcStart = new Date(start.getTime() - 3 * 60 * 60 * 1000);
      const utcEnd = new Date(end.getTime() - 3 * 60 * 60 * 1000);

      where.statusUpdatedAt = Between(utcStart, utcEnd);
    } else if (status && status !== 'ALL') {
      where.status = status;
    }

    const [data, total] = await this.orderRepo.findAndCount({
      where,
      relations: ['employee', 'items', 'items.product'],
      order: { orderNumber: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      page,
      limit,
      total,
      lastPage: Math.ceil(total / limit),
    };
  }







  async findOrderByOrderNumber(orderNumber: string) {
    // 1) تأكد أن القيم رقم صحيح فقط
    if (!/^\d+$/.test(orderNumber)) {
      throw new Error("الرجاء إدخال رقم صحيح فقط");
    }

    const orderNum = parseInt(orderNumber);

    // 2) البحث عن الطلب
    return this.orderRepo.findOne({
      where: { orderNumber: orderNum },
      relations: ['employee', 'items', 'items.product'],
    });
  }


  async searchOrderByOrderNumberForProcessor(orderNumber: string) {
    // 1) تأكد أن القيمة رقم صحيح فقط
    if (!/^\d+$/.test(orderNumber)) {
      throw new Error("الرجاء إدخال رقم صحيح فقط");
    }

    const orderNum = parseInt(orderNumber);

    // 2) البحث عن الطلب بشرط أن الحالة ليست UNCONFIRMED
    return this.orderRepo.findOne({
      where: {
        orderNumber: orderNum,
        status: Not(OrderStatus.UNCONFIRMED), // ⬅️ فقط الطلبات المؤكدة أو الأخرى
      },
      relations: ['employee', 'items', 'items.product'],
    });
  }




  async searchByOrderNumberOrPhone(value: string) {
    if (!value) {
      throw new BadRequestException('الرجاء إدخال قيمة للبحث');
    }

    const cleaned = value.trim();

    // أرقام فقط (تحقق عام)
    if (!/^\d+$/.test(cleaned)) {
      throw new BadRequestException('الرجاء إدخال أرقام فقط');
    }

    // 🚫 أكثر من 11 رقم غير مقبول
    if (cleaned.length > 11) {
      throw new BadRequestException('قيمة البحث غير صالحة');
    }

    // 📞 هاتف = 11 رقم
    if (cleaned.length === 11) {
      return this.orderRepo.find({
        where: [
          { customerPhone: Like(`%${cleaned}%`) },
          { customerPhone2: Like(`%${cleaned}%`) },
          { whatsappNumber: Like(`%${cleaned}%`) },
        ],
        relations: ['employee', 'items', 'items.product'],
        order: { createdAt: 'DESC' },
      });
    }

    // 🧾 رقم طلب (< 11 رقم) ➜ نفس المعالجة القديمة
    const order = await this.findOrderByOrderNumber(cleaned);

    return order ? [order] : [];
  }



  async searchOrderByNumberForEmployee(orderNumber: string, employeeId: string) {
    if (!/^\d+$/.test(orderNumber)) {
      throw new BadRequestException("الرجاء إدخال رقم صحيح فقط");
    }

    const orderNum = parseInt(orderNumber);

    // جلب جميع IDs للموظف + الموظفين أسفله
    const employeeTreeIds = await this.employeeService.getEmployeeTreeIds(employeeId);

    // البحث فقط ضمن هؤلاء الموظفين
    return this.orderRepo.findOne({
      where: {
        orderNumber: orderNum,
        employee: { id: In(employeeTreeIds) },
      },
      relations: ['employee', 'items', 'items.product'],
    });
  }






  async exportOrdersToExcel(ids: number[]): Promise<Buffer> {
    if (!ids || ids.length === 0) {
      throw new Error("لم يتم إرسال أي أرقام");
    }

    const orders = await this.orderRepo.find({
      where: { id: In(ids) },
      relations: ['employee', 'items', 'items.product'],
      order: { createdAt: 'DESC' }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('الطلبات'); // ← اسم عربي
    sheet.views = [
      { rightToLeft: true }
    ];
    // اجعل اتجاه النصوص في كامل الورقة RTL (محاذاة يمين)
    sheet.properties.defaultRowHeight = 20;

    // العناوين
    const header = [
      "رقم الطلب",
      "اسم الزبون",
      "هاتف الزبون",
      "اسم المسوّق",
      "المحافظة",
      "القضاء",
      "المنطقة",
      "اسم الموظف (منشئ الطلب)",
      "المبلغ الكلي",
      "تاريخ الإنشاء",
      "حالة الطلب",
      "كود المنتج",
      "اسم المنتج",
      "الكمية",
      "نقاط المنتج cc",
      "إجمالي نقاط الطلب cc",
      // "مجموع المنتج",
    ];

    const headerRow = sheet.addRow(header);

    // تنسيق العناوين RTL + Bold
    headerRow.eachCell((cell) => {
      cell.alignment = { horizontal: 'right' };  // محاذاة يمين
      cell.font = { bold: true };
    });

    for (const order of orders) {
      // const orderTotalCC = order.items.reduce(
      //   (sum, item) => sum + item.quantity * item.cc,
      //   0
      // );

      for (const item of order.items) {
        const row = sheet.addRow([
          order.id,
          order.customerName,
          order.customerPhone,
          order.marketerName ?? "",
          order.governorate,
          order.district,
          order.area,
          order.employee?.name || "غير محدد",
          order.totalAmount,
          order.createdAt?.toLocaleString("en-US"),
          order.status,

          item.product?.code ?? "محذوف",
          item.product?.name ?? "محذوف",
          item.quantity,
          item.cc,
          item.quantity * item.cc,
          // orderTotalCC
        ]);

        // محاذاة RTL لكل الصفوف
        row.eachCell((cell) => {
          cell.alignment = { horizontal: 'right' };
        });
      }
    }

    // توسيع الأعمدة لكي تكون مناسبة للعربي
    sheet.columns.forEach((column) => {
      column.width = 20;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }





  // -------------------- Generate Receipt PDF (Playwright + Handlebars) --------------------
  async generateOrderReceiptPdf(orderId: number): Promise<Buffer> {

    // 1) Fetch order
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['employee', 'items', 'items.product'],
    });

    if (!order) throw new Error("الطلب غير موجود");


    // الموظف الذي أضاف الطلب
    const employeeHierarchy = order.employee
      ? await this.employeeService.getEmployeeHierarchyUserName(order.employee.id)
      : [];

    // أضف اسم الشركة بالبداية
    const clientHierarchyName = ['أمواج الخير', ...employeeHierarchy].join('/');


    // 2) Generate QR Code
    const qrCodeDataURL = await QRCode.toDataURL(order.orderNumber.toString(), {
      width: 200,
      margin: 1,
    });

    // 3) Load HTML Template
    let templatePath = path.join(__dirname, 'templates', 'order-receipt.template.html');

    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(process.cwd(), 'src', 'order', 'templates', 'order-receipt.template.html');
    }

    const templateHtml = fs.readFileSync(templatePath, 'utf-8');

    // 4) Register Helpers if needed
    Handlebars.registerHelper("formatNumber", (value: number) =>
      value.toLocaleString('en-US')
    );

    // 5) Compile the template
    const template = Handlebars.compile(templateHtml);

    // جلب سعر التوصيل من جدول Setting
    const setting = await this.settingRepo.findOne({ where: {} });
    const deliveryPrice = setting ? setting.deliveryPrice : 0;
    // 6) Prepare data for HTML
    const html = template({
      orderId: order.id,
      orderNumber: order.orderNumber,
      clientHierarchyName,
      customerName: order.customerName,
      marketerName: order.marketerName || order.employee?.name || "غير محدد",
      governorate: order.governorate,
      district: order.district,
      area: order.area,
      customerPhone: order.customerPhone,
      totalAmount: (order.totalAmount).toLocaleString('en-US'),
      // totalAmount: (order.totalAmount - deliveryPrice).toLocaleString('en-US'),
      qrCodeDataURL: qrCodeDataURL,
      notes: order.notes ?? "",
      items: order.items.map(item => ({
        // عرض: رمز المنتج (الكمية)
        name: `${item.product?.code ?? "غير محدد"} (${item.quantity})`,
        quantity: item.quantity,
        cc: item.cc,
        totalCC: (item.quantity * item.cc),
      }))
    });

    // 7) Launch Playwright Chromium
    const browser = await chromium.launch({
      headless: true,
      args: process.platform === 'linux'
        ? ['--no-sandbox', '--disable-setuid-sandbox']
        : [],
    });


    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });

    // 8) Generate PDF
    const pdfBuffer = await page.pdf({
      printBackground: true,
      width: "100mm",
      height: "150mm",
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      }
    });


    await browser.close();

    return Buffer.from(pdfBuffer);
  }




  async generateBulkReceiptsPdf(ids: number[]): Promise<Buffer> {

    // تحميل الطلبات
    const orders = await this.orderRepo.find({
      where: { id: In(ids) },
      relations: ['employee', 'items', 'items.product'],
    });

    if (orders.length === 0) {
      throw new Error("لم يتم العثور على الطلبات");
    }


    // المتصفح
    const browser = await chromium.launch({
      headless: true,
      args: process.platform === 'linux'
        ? ['--no-sandbox', '--disable-setuid-sandbox']
        : [],
    });


    // تحميل قالب HTML
    let templatePath = path.join(__dirname, 'templates', 'order-receipt.template.html');
    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(process.cwd(), 'src', 'order', 'templates', 'order-receipt.template.html');
    }

    const templateHtml = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateHtml);

    Handlebars.registerHelper("formatNumber", (v: number) =>
      v.toLocaleString('en-US')
    );

    // ملف PDF النهائي الفارغ
    const finalPdf = await PDFLibDocument.create();

    // ------------------ إنشاء PDF لكل طلب --------------------
    for (const order of orders) {

      // الموظف الذي أضاف الطلب
      const employeeHierarchy = order.employee
        ? await this.employeeService.getEmployeeHierarchyUserName(order.employee.id)
        : [];

      // أضف اسم الشركة بالبداية
      const clientHierarchyName = ['هافانا', ...employeeHierarchy].join('/');


      const qrCode = await QRCode.toDataURL(order.orderNumber.toString());

      // جلب سعر التوصيل من جدول Setting
      const setting = await this.settingRepo.findOne({ where: {} });
      const deliveryPrice = setting ? setting.deliveryPrice : 0;

      // بناء HTML
      const html = template({
        orderId: order.id,
        orderNumber: order.orderNumber,
        clientHierarchyName,
        customerName: order.customerName,
        marketerName: order.marketerName || order.employee?.name || "غير محدد",
        governorate: order.governorate,
        district: order.district,
        area: order.area,
        customerPhone: order.customerPhone,
        // totalAmount: (order.totalAmount - deliveryPrice).toLocaleString('en-US'),
        totalAmount: (order.totalAmount).toLocaleString('en-US'),
        qrCodeDataURL: qrCode,
        notes: order.notes ?? "",
        items: order.items.map(item => ({
          name: `${item.product?.code ?? "غير محدد"} (${item.quantity})`,
          quantity: item.quantity,
          cc: item.cc,
          totalCC: (item.quantity * item.cc),
        }))
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });

      // ← ← نفس دالة المفرد بالضبط
      const singlePdfBuffer = await page.pdf({
        printBackground: true,
        width: "100mm",
        height: "150mm",
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" }
      });

      await page.close();

      // دمج ملف PDF المصغّر داخل الملف النهائي
      const currentPdf = await PDFLibDocument.load(singlePdfBuffer);
      const copiedPages = await finalPdf.copyPages(currentPdf, currentPdf.getPageIndices());
      copiedPages.forEach(p => finalPdf.addPage(p));

    }

    await browser.close();

    // إرجاع الملف النهائي
    const finalPdfBytes = await finalPdf.save();
    return Buffer.from(finalPdfBytes);
  }


  async deleteOrder(orderId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1️⃣ جلب الطلب مع العناصر والمنتجات
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: orderId },
        relations: ['items', 'items.product'],
      });

      if (!order) {
        throw new NotFoundException('الطلب غير موجود');
      }

      // 2️⃣ إعادة الكميات للمخزن فقط إذا كان الطلب "نشطاً" (لم يتم تسليمه أو إرجاعه مسبقاً)
      // الحالات النشطة هي التي خصمت من المخزن ولم تُرجعه بعد: UNCONFIRMED, DELIVERING, PROCESSING
      const shouldReturnStock = [
        OrderStatus.UNCONFIRMED,
        OrderStatus.DELIVERING,
        OrderStatus.PROCESSING,
      ].includes(order.status);

      if (shouldReturnStock) {
        for (const item of order.items) {
          if (item.product) {
            await queryRunner.manager.increment(
              Product,
              { code: item.product.code },
              'quantity',
              item.quantity
            );
          }
        }
      }

      // 3️⃣ حذف العناصر المرتبطة بالطلب
      await queryRunner.manager.delete(OrderItem, { order: { id: orderId } });

      // 4️⃣ حذف الطلب نفسه
      await queryRunner.manager.delete(Order, { id: orderId });

      await queryRunner.commitTransaction();

      return { message: 'تم حذف الطلب وإعادة الكميات للمخزن' };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }



  async bulkDeleteOrdersWithStock(ids: number[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let deletedCount = 0;

      for (const orderId of ids) {
        // جلب الطلب مع العناصر والمنتجات
        const order = await queryRunner.manager.findOne(Order, {
          where: { id: orderId },
          relations: ['items', 'items.product'],
        });

        if (!order) continue; // إذا الطلب مش موجود، نتخطاه

        // إعادة الكميات للمخزن فقط للطلبات النشطة
        const shouldReturnStock = [
          OrderStatus.UNCONFIRMED,
          OrderStatus.DELIVERING,
          OrderStatus.PROCESSING,
        ].includes(order.status);

        if (shouldReturnStock) {
          for (const item of order.items) {
            if (item.product) {
              await queryRunner.manager.increment(
                Product,
                { code: item.product.code },
                'quantity',
                item.quantity
              );
            }
          }
        }

        // حذف العناصر المرتبطة بالطلب
        await queryRunner.manager.delete(OrderItem, { order: { id: orderId } });

        // حذف الطلب نفسه
        await queryRunner.manager.delete(Order, { id: orderId });

        deletedCount++;
      }

      await queryRunner.commitTransaction();
      return { deletedCount };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }


}