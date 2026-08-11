import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Employee } from '../employee/entities/employee.entity';
import { Repository } from 'typeorm';
import { CustomerPoint } from '../customer-points/entities/customer-point.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Order } from 'src/order/entities/order.entity';
import { Setting } from 'src/settings/entities/setting.entity';
import { EmployeeAlert } from 'src/alerts/entities/employee-alert.entity';
import { OrderNotification } from 'src/notification/entities/order-notification.entity';

@Injectable()
export class StatisticsService {
    constructor(
        @InjectRepository(Employee)
        private readonly employeeRepo: Repository<Employee>,

        @InjectRepository(Order)
        private readonly orderRepo: Repository<Order>,

        @InjectRepository(CustomerPoint)
        private readonly customerPointRepo: Repository<CustomerPoint>,

        @InjectRepository(Expense)
        private readonly expenseRepo: Repository<Expense>,

        @InjectRepository(Setting)
        private readonly settingRepo: Repository<Setting>,


        @InjectRepository(OrderNotification)
        private readonly orderNotificationRepo: Repository<OrderNotification>,

        @InjectRepository(EmployeeAlert)
        private readonly employeeAlertRepo: Repository<EmployeeAlert>,



    ) { }

    /** -----------------------------------------------------------
     *  دالة جلب كل الموظفين داخل الهرم بدءًا من الموظف الأب
     * ------------------------------------------------------------ */
    async getEmployeeHierarchy(rootEmployeeId: string): Promise<string[]> {
        if (rootEmployeeId === 'system-root') {
            const all = await this.employeeRepo.find({ select: ['id'] });
            return all.map(e => e.id);
        }

        const ids: string[] = [];

        const traverse = async (empId: string) => {
            const emp = await this.employeeRepo.findOne({
                where: { id: empId },
                relations: ['children'],
            });
            if (!emp) return;

            ids.push(emp.id);

            if (emp.children?.length) {
                for (const child of emp.children) {
                    await traverse(child.id); // استدعاء تكراري لكل موظف
                }
            }
        };

        await traverse(rootEmployeeId);
        return ids;
    }


    /** -----------------------------------------------------------
     *     كل المعلومات المطلوبة على مستوى الهرم كامل
     * ------------------------------------------------------------ */
    async getStatisticsForEmployeeHierarchy(employeeId: string) {
        const employeeIds = await this.getEmployeeHierarchy(employeeId);

        /* -------------------------------------------------------
         * 1) عدد المواد (sum of items.quantity)
         * ------------------------------------------------------ */
        const materialsRow = await this.orderRepo
            .createQueryBuilder('o')
            .leftJoin('o.items', 'items')
            .select('SUM(items.quantity)', 'total')
            .where(`o."employeeId" IN (:...ids)`, { ids: employeeIds })
            .andWhere('o.status NOT IN (:...excludedStatuses)', { excludedStatuses: ['REJECTED', 'RETURNED', 'ARCHIVED_RETURNED'] })
            .getRawOne();

        const totalMaterials = Number(materialsRow?.total || 0);

        /* -------------------------------------------------------
         * 2) صافي المبلغ (totalAmount - deliveryPrice)
         * ------------------------------------------------------ */

        // 1) جلب إعدادات النظام
        const settings = await this.settingRepo.find();
        const setting = settings[0];

        if (!setting) throw new NotFoundException("Settings not found");

        const deliveryPrice = setting?.deliveryPrice ?? 0;

        // 2) حساب صافي المبلغ
        const netRow = await this.orderRepo
            .createQueryBuilder('o')
            .select(`SUM(o."totalAmount" - :deliveryPrice)`, 'net')
            .where(`o."employeeId" IN (:...ids)`, { ids: employeeIds })
            .andWhere(`o.status IN (:...statuses)`, { statuses: ['DELIVERED', 'ARCHIVED_DELIVERED'] })
            .setParameter('deliveryPrice', deliveryPrice)
            .getRawOne();

        const netAmount = Number(netRow?.net || 0);


        /* -------------------------------------------------------
         * 3) مجموع مصاريف الهرم
         * ------------------------------------------------------ */
        const expenseRow = await this.expenseRepo
            .createQueryBuilder('e')
            .select(`
        SUM(
            CASE 
                WHEN e.type = 'DEPOSIT' THEN e.amount
                WHEN e.type = 'WITHDRAW' THEN -e.amount
                ELSE 0
            END
        )`, 'total')
            .where(`e."employeeId" IN (:...ids)`, { ids: employeeIds })
            .getRawOne();

        const totalExpenses = Number(expenseRow?.total || 0);


        /* -------------------------------------------------------
         * 4) مجموع نقاط العملاء
         * ------------------------------------------------------ */
        const pointRow = await this.customerPointRepo
            .createQueryBuilder('p')
            .select(`
        SUM(
            CASE
                WHEN p.type = 'ADD' THEN p.points
                WHEN p.type = 'SUBTRACT' THEN -p.points
                ELSE 0
            END
        )`, 'total')
            .where(`p."employeeId" IN (:...ids)`, { ids: employeeIds })
            .getRawOne();

        const totalCustomerPoints = Number(pointRow?.total || 0);

        /* -----------------------------------------------------------
         * 5) حساب نقاط المنتجات داخل الطلبات (product.cc * quantity)
         * ----------------------------------------------------------- */

        const productPointsRow = await this.orderRepo
            .createQueryBuilder('o')
            .leftJoin('o.items', 'items')
            .leftJoin('items.product', 'product')
            .select(`SUM(items.quantity * product.cc)`, 'total')
            .where(`o."employeeId" IN (:...ids)`, { ids: employeeIds })
            .andWhere('o.status NOT IN (:...excludedStatuses)', { excludedStatuses: ['REJECTED', 'RETURNED', 'ARCHIVED_RETURNED'] })
            .getRawOne();

        const totalProductPoints = Number(productPointsRow?.total || 0);

        /* -----------------------------------------------------------
         *) حساب نقاط المخزن النهائية
         * ----------------------------------------------------------- */

        const warehousePoints = Number(
            (-totalProductPoints + totalCustomerPoints).toFixed(2)
        ).toString();



        /* -------------------------------------------------------
         * 6) عدد الطلبات حسب الحالة
         * ------------------------------------------------------ */
        const rawStatusCounts = await this.orderRepo
            .createQueryBuilder('o')
            .select('o.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .where(`o."employeeId" IN (:...ids)`, { ids: employeeIds })
            .groupBy('o.status')
            .getRawMany();



        /* -------------------------------------------------------
         * 8) عدد الإشعارات والتنبيهات غير المقروءة للموظف الحالي
         * ------------------------------------------------------ */

        // إشعارات الطلبات غير المقروءة
        const unreadOrderNotificationsRow =
            await this.orderNotificationRepo
                .createQueryBuilder('n')
                .select('COUNT(*)', 'count')
                .where('n."employeeId" = :id', { id: employeeId })
                .andWhere('n."isRead" = false')
                .getRawOne();

        const unreadOrderNotifications =
            Number(unreadOrderNotificationsRow?.count || 0);

        // التنبيهات غير المقروءة
        const unreadAlertsRow =
            await this.employeeAlertRepo
                .createQueryBuilder('ea')
                .select('COUNT(*)', 'count')
                .where('ea."employeeId" = :id', { id: employeeId })
                .andWhere('ea."isRead" = false')
                .getRawOne();

        const unreadAlerts =
            Number(unreadAlertsRow?.count || 0);

        // المجموع الكلي
        const totalUnreadNotifications =
            unreadOrderNotifications + unreadAlerts;




        const orderStatusCount = {
            UNCONFIRMED: 0,
            REJECTED: 0,
            DELIVERING: 0,
            PROCESSING: 0,
            RETURNED: 0,
            DELIVERED: 0,
            ARCHIVED_RETURNED: 0,
            ARCHIVED_DELIVERED: 0,
        };

        rawStatusCounts.forEach(row => {
            const status = row.status;
            const count = Number(row.count);

            if (orderStatusCount[status] !== undefined) {
                orderStatusCount[status] = count;
            }
        });

        /* -------------------------------------------------------
         * 7) الإرجاع النهائي
         * ------------------------------------------------------ */
        return {
            employeesInHierarchy: employeeIds.length - 1, // استبعاد الموظف الأب
            materials: totalMaterials,
            netAmount,
            expenses: totalExpenses,
            customerPoints: totalCustomerPoints,
            warehousePoints,
            orderStatusCount,
            totalUnreadNotifications,
        };
    }




    /** -----------------------------------------------------------
    *   عدد الاشعارات للمعالج فقط
    * ------------------------------------------------------------ */
    async getStatisticsForProcessor(employeeId: string) {


        // إشعارات الطلبات غير المقروءة
        const unreadOrderNotificationsRow =
            await this.orderNotificationRepo
                .createQueryBuilder('n')
                .select('COUNT(*)', 'count')
                .where('n."employeeId" = :id', { id: employeeId })
                .andWhere('n."isRead" = false')
                .getRawOne();

        const unreadOrderNotifications =
            Number(unreadOrderNotificationsRow?.count || 0);

        // التنبيهات غير المقروءة
        const unreadAlertsRow =
            await this.employeeAlertRepo
                .createQueryBuilder('ea')
                .select('COUNT(*)', 'count')
                .where('ea."employeeId" = :id', { id: employeeId })
                .andWhere('ea."isRead" = false')
                .getRawOne();

        const unreadAlerts =
            Number(unreadAlertsRow?.count || 0);

        // المجموع الكلي
        const totalUnreadNotifications =
            unreadOrderNotifications + unreadAlerts;



        return {
            totalUnreadNotifications,
        };
    }

}
