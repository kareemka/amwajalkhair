import { Injectable } from '@nestjs/common';
import { ReportsService } from './reports.service';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { chromium } from 'playwright';

@Injectable()
export class ReportsPDFService {
    constructor(private readonly reportsService: ReportsService) { }

    async generateMonthlyReportPdf(employeeId: string, year: number, month: number): Promise<Buffer> {
        // 1️⃣ جلب تقرير الشهر من ReportsService
        const report = await this.reportsService.getMonthlyReport(employeeId, year, month);

        // 2️⃣ احصل على اسم الموظف من ReportsService أو EmployeeService
        // لنفترض أن ReportsService يعيد employeeId فقط، ونحتاج لجلب الاسم
        const employeeName = await this.reportsService.getEmployeeName(employeeId);

        // 3️⃣ تجهيز تاريخ التقرير
        const today = new Date();
        const reportDate = today.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        // 4️⃣ تجهيز قالب HTML
        let templatePath = path.join(__dirname, 'templates', 'monthly-report.template.html');
        if (!fs.existsSync(templatePath)) {
            templatePath = path.join(process.cwd(), 'src', 'reports', 'templates', 'monthly-report.template.html');
        }
        const templateHtml = fs.readFileSync(templatePath, 'utf-8');

        // 5️⃣ Helpers لتنسيق الأرقام

        Handlebars.registerHelper('formatNumber', (value: number) => value.toLocaleString('en-US'));
        Handlebars.registerHelper('formatCurrency', (value: number) => {
            if (!value) return '0';
            return value.toLocaleString('en-US', { style: 'currency', currency: 'IQD', minimumFractionDigits: 0 });
        });

        // 6️⃣ Compile القالب
        const template = Handlebars.compile(templateHtml);

        // 7️⃣ دمج البيانات مع القالب
        const html = template({
            month: report.month,
            year: report.year,
            employeeName,
            employeesIncluded: report.employeesIncluded,
            totalExpenses: report.totalExpenses,
            expensesCount: report.expensesCount,
            totalPoints: report.totalPoints,
            totalSales: report.totalSales,
            netSales: report.netSales,
            returnedOrders: report.returnedOrders,
            reportDate,
        });

        // 8️⃣ توليد PDF باستخدام Playwright
        const browser = await chromium.launch({
            headless: true,
            args: process.platform === 'linux'
                ? ['--no-sandbox', '--disable-setuid-sandbox']
                : [],
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle' });

        const pdfBuffer = await page.pdf({
            printBackground: true,
            format: 'A4',
            margin: {
                top: '10mm',
                bottom: '10mm',
                left: '6mm',
                right: '6mm',
            },
        });

        await browser.close();

        return Buffer.from(pdfBuffer);
    }
}
