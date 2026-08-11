import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Alert } from './entities/alert.entity';
import { EmployeeAlert } from './entities/employee-alert.entity';
import { Employee } from 'src/employee/entities/employee.entity';
import { NotificationService } from 'src/notification/notification.service';


@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,

    @InjectRepository(EmployeeAlert)
    private readonly employeeAlertRepository: Repository<EmployeeAlert>,

    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,

    private readonly notificationService: NotificationService,
  ) { }



  // إنشاء تنبيه جديد وتوليد EmployeeAlert لكل موظف
  async createAlert(title: string, details: string): Promise<Alert> {
    // 1️⃣ إنشاء التنبيه
    const alert = this.alertRepository.create({ title, details });
    await this.alertRepository.save(alert);

    // 2️⃣ جلب الموظفين مع FCM tokens
    const employees = await this.employeeRepository.find({
      select: ['id', 'fcmTokens'],
    });

    // 3️⃣ إنشاء EmployeeAlert
    const employeeAlerts = employees.map(employee =>
      this.employeeAlertRepository.create({
        employee: { id: employee.id } as Employee,
        alert,
        isRead: false,
      }),
    );

    await this.employeeAlertRepository.save(employeeAlerts);

    // 4️⃣ تجميع كل FCM Tokens
    const tokens = employees
      .flatMap(e => e.fcmTokens ?? [])
      .filter(Boolean);

    if (!tokens.length) return alert;

    // 5️⃣ إرسال Push Notification
    await this.notificationService.sendToEmployeeTokens(
      tokens,
      'تنبيه جديد',
      title,
      {
        alertId: alert.id.toString(),
        screen: 'alerts',
      },
    );

    return alert;
  }


  // async createAlert(title: string, details: string): Promise<Alert> {
  //   // 1️⃣ إنشاء التنبيه
  //   const alert = this.alertRepository.create({ title, details });
  //   await this.alertRepository.save(alert);

  //   // 2️⃣ جلب كل الموظفين
  //   const employees = await this.employeeRepository.find();

  //   // 3️⃣ إنشاء سجل EmployeeAlert لكل موظف
  //   const employeeAlerts = employees.map(employee =>
  //     this.employeeAlertRepository.create({
  //       employee,
  //       alert,
  //       isRead: false,
  //     }),
  //   );

  //   await this.employeeAlertRepository.save(employeeAlerts);

  //   return alert;
  // }

  // =========================
  // جلب التنبيهات مع Pagination
  // =========================
  async getAlerts(page: number = 1, limit: number = 10) {
    const [alerts, total] = await this.alertRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: alerts,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }


  // =========================
  // جلب التنبيهات مع Pagination للموظف
  // =========================
  async getEmployeeAlertsPaginated(
    employeeId: string,
    page: number,
    limit: number,
  ) {
    const skip = (page - 1) * limit;

    const [alerts, total] = await this.employeeAlertRepository
      .createQueryBuilder('employeeAlert')
      .leftJoinAndSelect('employeeAlert.alert', 'alert')
      .where('employeeAlert.employeeId = :employeeId', { employeeId })
      .orderBy('alert.createdAt', 'DESC') // الاحدث -> الاقدم
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: alerts.map((item) => ({
        id: item.alert.id,
        title: item.alert.title,
        details: item.alert.details,
        createdAt: item.alert.createdAt,
        isRead: item.isRead,
      })),
      total,
      page,
      limit,
    };
  }



  // تعليم كل إشعارات الموظف كمقروءة
  async markAllEmployeeAlertsRead(employeeId: string) {
    await this.employeeAlertRepository
      .createQueryBuilder()
      .update(EmployeeAlert)
      .set({ isRead: true })
      .where('employeeId = :employeeId', { employeeId })
      .execute();

    return { message: 'All alerts marked as read' };
  }


  // =========================
  // حذف تنبيه واحد
  // =========================
  async deleteAlert(id: number) {
    // حذف جميع EmployeeAlert المرتبطة أولاً
    await this.employeeAlertRepository.delete({ alert: { id } });
    // حذف التنبيه نفسه
    await this.alertRepository.delete(id);
    return { message: `Alert ${id} deleted successfully` };
  }

  // =========================
  // حذف متعدد
  // ids: array من أرقام التنبيهات
  // =========================
  async deleteMultipleAlerts(ids: number[]) {
    // حذف EmployeeAlert المرتبطة
    await this.employeeAlertRepository.delete({ alert: In(ids) });
    // حذف التنبيهات نفسها
    await this.alertRepository.delete(ids);
    return { message: `Alerts deleted successfully`, count: ids.length };
  }

}
