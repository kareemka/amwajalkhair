import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EmployeeService } from 'src/employee/employee.service';
import { Order } from 'src/order/entities/order.entity';
import { Expense, ExpenseType } from 'src/expenses/entities/expense.entity';
import { OrderStatus } from 'src/utils/order-status.enum';
import { Between, In, Repository } from 'typeorm';
import { getMonthRange } from './reports.utils';
import { SettingsService } from 'src/settings/settings.service';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class ReportsService {
  private genAI: GoogleGenerativeAI;
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,

    private readonly employeeService: EmployeeService,
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.genAI = new GoogleGenerativeAI(apiKey || '');
  }

  async getEmployeeName(employeeId: string): Promise<string> {
    const employee = await this.employeeService.findOne(employeeId);
    return employee?.name || 'غير معروف';
  }

  async getMonthlyReport(employeeId: string, year: number, month: number) {
    const { start, end } = getMonthRange(year, month);

    const employeeTreeIds = await this.employeeService.getEmployeeTreeIds(employeeId);
    const mainEmployee = await this.employeeService.findOne(employeeId);

    const deliveredStatuses = [OrderStatus.DELIVERED, OrderStatus.ARCHIVED_DELIVERED];
    const deliveredOrders = await this.orderRepo.find({
      where: { employee: { id: In(employeeTreeIds) }, status: In(deliveredStatuses), createdAt: Between(start, end) },
      relations: ['items', 'items.product'],
    });

    let totalPoints = 0;
    for (const order of deliveredOrders) {
      for (const item of order.items) {
        if (item.product?.cc) {
          totalPoints += item.product.cc * item.quantity;
        }
      }
    }

    const returnedOrders = await this.orderRepo.count({
      where: { employee: { id: In(employeeTreeIds) }, status: OrderStatus.RETURNED, createdAt: Between(start, end) },
    });

    const totalSalesRaw = await this.orderRepo
      .createQueryBuilder("o")
      .select("SUM(o.totalAmount)", "total")
      .where("o.employeeId IN (:...ids)", { ids: employeeTreeIds })
      .andWhere("o.createdAt BETWEEN :start AND :end", { start, end })
      .andWhere("o.status IN (:...statuses)", { statuses: [OrderStatus.DELIVERED, OrderStatus.ARCHIVED_DELIVERED] })
      .getRawOne();

    const totalSales = Number(totalSalesRaw.total) || 0;

    const settings = await this.settingsService.getSettings();
    const deliveryPrice = settings.deliveryPrice ?? 0;

    const deliveredOrdersCount = await this.orderRepo.count({
      where: {
        employee: { id: In(employeeTreeIds) },
        status: In([OrderStatus.DELIVERED, OrderStatus.ARCHIVED_DELIVERED]),
        createdAt: Between(start, end),
      },
    });

    const totalDelivery = deliveryPrice * deliveredOrdersCount;
    let netSales = totalSales - totalDelivery;

    const expensesStats = await this.expenseRepo
      .createQueryBuilder('e')
      .select([
        `
    SUM(
      CASE 
        WHEN e.type = :deposit THEN e.amount
        WHEN e.type = :withdraw THEN -e.amount
        ELSE 0
      END
    ) AS total
    `,
        'COUNT(e.id) AS count',
      ])
      .where('e.employeeId IN (:...ids)', { ids: employeeTreeIds })
      .andWhere('e.createdAt BETWEEN :start AND :end', { start, end })
      .setParameters({
        deposit: ExpenseType.DEPOSIT,
        withdraw: ExpenseType.WITHDRAW,
      })
      .getRawOne();

    const totalExpenses = Number(expensesStats?.total) || 0;
    const expensesCount = Number(expensesStats?.count) || 0;

    return {
      month,
      year,
      employeeId,
      employeeName: mainEmployee?.name ?? 'غير معروف',
      employeesIncluded: employeeTreeIds.length,
      totalExpenses,
      expensesCount,
      totalPoints,
      totalSales,
      deliveryPrice,
      netSales,
      returnedOrders,
    };
  }

  async getAiMonthlySummary(employeeId: string, year: number, month: number) {
    const reportData = await this.getMonthlyReport(employeeId, year, month);

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      return "عذراً، لم يتم إعداد مفتاح Gemini (GEMINI_API_KEY) في السيرفر. يرجى إضافته للحصول على التحليل الذكي.";
    }

    try {
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-3.1-flash-lite-preview',
        systemInstruction: 'أنت خبير مالي ومحلل بيانات تعمل في نظام إدارة مبيعات (Havana). مهمتك هي تلخيص التقارير الشهرية بأسلوب احترافي ومفيد.'
      });

      const prompt = `يرجى تلخيص تقرير المبيعات الشهري التالي باللغة العربية:
البيانات:
- الموظف/الفرع: ${reportData.employeeName}
- الشهر والعام: ${reportData.month}/${reportData.year}
- عدد الطلبات المرتجعة: ${reportData.returnedOrders}
- إجمالي المبيعات: ${reportData.totalSales} د.ع
- إجمالي المصاريف: ${reportData.totalExpenses} د.ع
- سعر التوصيل المعتمد: ${reportData.deliveryPrice} د.ع
- صافي الأرباح (بعد خصم التوصيل والمصاريف): ${reportData.netSales} د.ع

المطلوب:
1. نظرة عامة على الأداء.
2. أبرز الإيجابيات.
3. الملاحظات (مثل المرتجعات أو المصاريف).
4. نصيحة للتحسين.

اكتب الرد مباشرة باستخدام Markdown بدون مقدمات.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text() || "عذراً، لم أتمكن من توليد الملخص الذكي في الوقت الحالي.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي (Gemini). يرجى المحاولة لاحقاً.";
    }
  }
}
