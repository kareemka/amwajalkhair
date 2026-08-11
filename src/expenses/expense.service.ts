// expense.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Expense, ExpenseType } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { Employee } from 'src/employee/entities/employee.entity';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import * as Handlebars from 'handlebars';
import { chromium } from 'playwright';
import { EmployeeService } from 'src/employee/employee.service';



@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(Expense)
    private expenseRepo: Repository<Expense>,

    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,

    private employeeService: EmployeeService,
  ) { }

  async addExpense(dto: CreateExpenseDto) {
    const employee = await this.employeeRepo.findOneBy({ id: dto.employeeId });
    if (!employee) throw new NotFoundException('Employee not found');

    const exp = this.expenseRepo.create({
      amount: dto.amount,
      transferType: dto.transferType,
      type: dto.type,
      employee,
    });

    return this.expenseRepo.save(exp);
  }



  async getEmployeeExpensesPaginated(
    employeeId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    // جلب البيانات المصفحة
    const [records, count] = await this.expenseRepo.findAndCount({
      where: { employee: { id: employeeId } },
      relations: ['employee'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // حساب مجموع المبالغ لجميع السجلات للموظف باستخدام استعلام SUM
    const totalAmountRow = await this.expenseRepo
      .createQueryBuilder('e')
      .select(`
      SUM(
        CASE
          WHEN e.type = '${ExpenseType.DEPOSIT}' THEN e.amount
          WHEN e.type = '${ExpenseType.WITHDRAW}' THEN -e.amount
          ELSE 0
        END
      )`, 'total')
      .where('e.employeeId = :id', { id: employeeId })
      .getRawOne();

    const totalAmount = Number(totalAmountRow?.total || 0);

    return {
      page,
      limit,
      totalRecords: count,
      lastPage: Math.ceil(count / limit),
      totalAmount,
      records,
    };
  }




  // للهرم كامل

  async getEmployeeHierarchyExpenses(
    employeeId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const where: any = {};
    let ids: string[] = [];

    if (employeeId !== 'system-root') {
      ids = await this.employeeService.getEmployeeTreeIds(employeeId);
      where.employee = { id: In(ids) };
    }

    const skip = (page - 1) * limit;

    // 2) جلب المصاريف
    const [records, count] = await this.expenseRepo.findAndCount({
      where,
      relations: ['employee'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // 3) حساب مجموع الرصيد للهرم كامل
    const queryBuilder = this.expenseRepo.createQueryBuilder('e')
      .select(`
      SUM(
        CASE
          WHEN e.type = '${ExpenseType.DEPOSIT}' THEN e.amount
          WHEN e.type = '${ExpenseType.WITHDRAW}' THEN -e.amount
          ELSE 0
        END
      ) as total
    `);

    if (employeeId !== 'system-root' && ids.length > 0) {
      queryBuilder.where('e.employeeId IN (:...ids)', { ids });
    }

    const totalAmountRow = await queryBuilder.getRawOne();

    const totalAmount = Number(totalAmountRow?.total || 0);

    return {
      employeeId,
      hierarchyIds: ids,
      page,
      limit,
      totalRecords: count,
      lastPage: Math.ceil(count / limit),
      totalAmount,
      records,
    };
  }

  async exportExcel(ids: number[]) {
    const records = await this.expenseRepo.find({
      where: { id: In(ids) },
      relations: ['employee'],
      order: { createdAt: 'DESC' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Havana System';

    const sheet = workbook.addWorksheet('Expenses', {
      views: [{ rightToLeft: true }],
    });

    sheet.addRow([]);
    const titleRow = sheet.addRow(['سجل المصاريف']);
    titleRow.font = { bold: true, size: 16 };
    sheet.mergeCells('A2:G2');
    titleRow.alignment = { horizontal: 'center' };

    sheet.addRow([]);

    // رؤوس الأعمدة
    sheet.addRow([
      'رقم السجل',
      'اسم الموظف',
      'اسم المستخدم',
      'المبلغ',
      'نوع التحويل',
      'نوع العملية',
      'التاريخ',
    ]);

    const header = sheet.getRow(sheet.lastRow.number);
    header.font = { bold: true, size: 12 };
    header.alignment = { horizontal: 'center' };

    records.forEach((rec) => {
      sheet.addRow([
        rec.id,
        rec.employee?.name || '',
        rec.employee?.username || '',
        rec.amount,
        rec.transferType,
        rec.type === 'DEPOSIT' ? 'إيداع' : 'سحب',
        rec.createdAt.toLocaleString('ar-EG', {
          hour12: true,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
      ]);
    });

    sheet.columns = [
      { width: 10 },
      { width: 20 },
      { width: 20 },
      { width: 10 },
      { width: 20 },
      { width: 12 },
      { width: 25 },
    ];

    return workbook.xlsx.writeBuffer();
  }

  async deleteOne(id: number) {
    const rec = await this.expenseRepo.findOneBy({ id });
    if (!rec) throw new NotFoundException('Record not found');

    await this.expenseRepo.delete(id);
    return { message: 'Record deleted successfully', id };
  }

  async deleteBulk(ids: number[]) {
    if (!ids?.length) return { message: 'No IDs provided' };

    await this.expenseRepo.delete(ids);
    return { message: 'Bulk deletion completed', deletedIds: ids };
  }




  async generateExpenseReceiptPdf(expenseId: number): Promise<Buffer> {

    // 1) Fetch expense
    const expense = await this.expenseRepo.findOne({
      where: { id: expenseId },
      relations: ['employee'],
    });

    if (!expense) throw new Error("السجل غير موجود");

    // 2) Generate QR Code
    const qrCodeDataURL = await QRCode.toDataURL(expense.id.toString(), {
      width: 200,
      margin: 1,
    });

    // 3) Load HTML Template
    let templatePath = path.join(__dirname, 'templates', 'expense-receipt.template.html');

    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(process.cwd(), 'src', 'expense', 'templates', 'expense-receipt.template.html');
    }

    const templateHtml = fs.readFileSync(templatePath, 'utf-8');

    // 4) Helpers
    Handlebars.registerHelper("formatNumber", (value: number) =>
      value.toLocaleString('en-US')
    );

    // 5) Compile
    const template = Handlebars.compile(templateHtml);

    // 6) Prepare Data
    const html = template({
      id: expense.id,
      employeeName: expense.employee?.name ?? "غير معروف",
      username: expense.employee?.username ?? "",
      amount: expense.amount.toLocaleString('en-US'),
      type: expense.type === 'DEPOSIT' ? 'إيداع' : 'سحب',
      transferType: expense.transferType,
      createdAt: expense.createdAt.toLocaleString('en-US'),
      qrCodeDataURL,
    });

    // 7) PDF generation
    const browser = await chromium.launch({
      headless: true,
      args: process.platform === 'linux'
        ? ['--no-sandbox', '--disable-setuid-sandbox']
        : [],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });

    const pdfBuffer = await page.pdf({
      printBackground: true,
      width: "100mm",
      height: "100mm",
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

}
