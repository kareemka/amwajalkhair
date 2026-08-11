import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { Employee, EmployeeRole } from './entities/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import * as bcrypt from 'bcryptjs';
import * as ExcelJS from 'exceljs';
import { Customer } from 'src/customer/entities/customer.entity';
import { PDFDocument as PDFLibDocument } from "pdf-lib";
import Handlebars from "handlebars";
import { chromium } from "playwright";
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import { forwardRef, Inject } from '@nestjs/common';
import { StatisticsService } from 'src/statistics/statistics.service';


@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private repo: Repository<Employee>,
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
    @Inject(forwardRef(() => StatisticsService))
    private statisticsService: StatisticsService,
  ) { }

  async create(dto: CreateEmployeeDto) {
    // Normalize role → uppercase
    if (dto.role) {
      dto.role = dto.role.toUpperCase() as any;
    }

    // تحقق من فريدية username
    const exists = await this.repo.findOne({ where: { username: dto.username } });
    if (exists) {
      throw new BadRequestException('Username already taken');
    }

    // استخراج parent عبر username
    let parent = null;
    if (dto.parentUsername) {
      parent = await this.repo.findOne({ where: { username: dto.parentUsername } });

      if (!parent) {
        throw new BadRequestException('Parent username not found');
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Sync referralCode with username for Leaders if not provided
    if (dto.role === EmployeeRole.LEADER && !dto.referralCode) {
      dto.referralCode = dto.username;
    }

    const employee = this.repo.create({
      ...dto,
      password: hashedPassword,
      parent: parent || null,
    });

    return this.repo.save(employee);
  }



  async allEmployees() {
    return this.repo.find({
      select: {
        id: true,
        name: true,
        role: true,
      },
      where: {
        isBlocked: false,
        role: EmployeeRole.LEADER,
      },
      order: {
        name: 'ASC',
      },
    });
  }




  async findAll(page: number = 1, limit: number = 10, role?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role) {
      where.role = role;
    }

    const [data, total] = await this.repo.findAndCount({
      where,
      skip,
      take: limit,
      order: { name: 'ASC' },
      relations: ['parent'], // نحتاج فقط parent لنعرض من الذي أضافه
    });

    // نظيف الحقل "addedBy" لكل موظف
    const formatted = data.map((emp) => ({
      ...emp,
      addedBy: emp.parent ? emp.parent.username : null,
    }));

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: formatted,
    };
  }







  /** -----------------------------------
    * جلب بيانات الهَرَم بالكامل
    * ----------------------------------- */
  async findHierarchy(id: string, page: number = 1, limit: number = 10) {
    // جلب كل IDs في الهَرَم بما فيهم الأب
    const employeeIds = await this.getEmployeeTreeIds(id);

    if (employeeIds.length === 0) throw new NotFoundException('Employee not found');

    // استبعاد الموظف الأب نفسه
    const hierarchyIds = employeeIds.filter(eId => eId !== id);

    const skip = (page - 1) * limit;

    const [data, total] = await this.repo.findAndCount({
      where: { id: In(hierarchyIds) },
      skip,
      take: limit,
      order: { name: 'ASC' },
      relations: ['parent'],
    });

    const formatted = data.map(emp => ({
      ...emp,
      addedBy: emp.parent ? emp.parent.username : null,
    }));

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      lastPage: Math.ceil(total / limit),
      data: formatted,
    };
  }





  async findOne(id: string) {
    if (id === 'system-root') {
      const admin = new Employee();
      admin.id = 'system-root';
      admin.name = 'نظام هافانا الرئيسي';
      admin.username = 'system-root';
      admin.role = EmployeeRole.MANAGER;
      admin.children = [];
      admin.isBlocked = false;
      return admin;
    }

    const employee = await this.repo.findOne({
      where: { id },
      relations: ['parent', 'children', 'orders'],
    });

    if (!employee) throw new NotFoundException('Employee not found');

    return employee;
  }

  async findByReferralCode(code: string) {
    return this.repo.findOne({
      where: [
        { referralCode: code },
        { username: code }
      ]
    });
  }

  async findByUsername(username: string) {
    return this.repo.findOne({
      where: { username }
    });
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const employee = await this.findOne(id);

    // إذا تم إرسال role → نعالجه إلى UPPERCASE
    if (dto.role) {
      dto.role = dto.role.toUpperCase() as any;
    }

    // معالجة parentUsername → parentId
    let parent = undefined;

    if (dto.parentUsername) {
      parent = await this.repo.findOne({
        where: { username: dto.parentUsername },
      });

      if (!parent) {
        throw new BadRequestException('Parent username not found');
      }
    }

    // معالجة تغيير كلمة المرور
    let hashedPassword = undefined;
    if (dto.password) {
      hashedPassword = await bcrypt.hash(dto.password, 10);
    }

    // نحذف parentUsername من dto لأنه غير موجود في Entity
    delete (dto as any).parentUsername;

    // Sync referralCode with username if it's a LEADER and username is being updated or referralCode is missing
    if (employee.role === EmployeeRole.LEADER || dto.role === EmployeeRole.LEADER) {
      if (dto.username && (!dto.referralCode || dto.referralCode === employee.username)) {
        dto.referralCode = dto.username;
      }
    }

    await this.repo.update(id, {
      ...dto,
      ...(hashedPassword && { password: hashedPassword }),
      ...(parent && { parent: parent }), // تحديث الأب إذا موجود
    });

    return this.findOne(id);
  }




  async updateEmployeeInTree(
    currentEmployeeId: string,
    targetEmployeeId: string,
    dto: UpdateEmployeeDto
  ) {
    // 1) جلب شجرة IDs للموظف الحالي
    const allowedIds = await this.getEmployeeTreeIds(currentEmployeeId);

    // 2) التأكد أن الموظف المستهدف داخل الشجرة
    if (!allowedIds.includes(targetEmployeeId)) {
      throw new ForbiddenException(
        'لا يمكنك تعديل موظف خارج نطاق صلاحياتك'
      );
    }

    // 3) جلب الموظف المستهدف
    const employee = await this.findOne(targetEmployeeId);

    // 4) منع تغيير role أو parent للموظف
    if (dto.role) {
      throw new ForbiddenException('لا يمكنك تغيير صلاحية الموظف');
    }
    if ((dto as any).parentUsername) {
      throw new ForbiddenException('لا يمكنك تغيير المشرف (parent)');
    }

    // 5) معالجة تغيير كلمة المرور إذا أرسلها
    let hashedPassword = undefined;
    if (dto.password) {
      hashedPassword = await bcrypt.hash(dto.password, 10);
    }

    // 6) تنفيذ التحديث
    await this.repo.update(targetEmployeeId, {
      ...dto,
      ...(hashedPassword && { password: hashedPassword }),
    });

    return this.findOne(targetEmployeeId);
  }






  async search(query: string) {
    if (!query || query.trim() === '') {
      return []; // لا يوجد بحث
    }

    const data = await this.repo.find({
      where: [
        { name: ILike(`%${query}%`) },
        { username: ILike(`%${query}%`) },
      ],
      relations: ['parent', 'children', 'orders'],
    });

    return data.map((emp) => ({
      ...emp,
      addedBy: emp.parent ? emp.parent.username : null,
    }));
  }




  async createByEmployee(dto: CreateEmployeeDto, parentId: string) {
    // Normalize role → uppercase
    if (dto.role) {
      dto.role = dto.role.toUpperCase() as any;
    }

    // التحقق من فريدية الـ username
    const exists = await this.repo.findOne({ where: { username: dto.username } });
    if (exists) {
      throw new BadRequestException('Username already taken');
    }

    // جلب الأب من parentId (الموظف اللي أضافه)
    const parent = await this.repo.findOne({ where: { id: parentId } });
    if (!parent) {
      throw new BadRequestException('Parent not found');
    }

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // إنشاء الموظف الجديد مع ربطه بالأب
    const employee = this.repo.create({
      ...dto,
      password: hashedPassword,
      parent, // هنا الربط
    });

    return this.repo.save(employee);
  }



  async getEmployeeTreeIds(id: string): Promise<string[]> {
    if (id === 'system-root') {
      const all = await this.repo.find({ select: ['id'] });
      return all.map(e => e.id);
    }

    const employee = await this.repo.findOne({
      where: { id },
      relations: ['children'],
    });

    if (!employee) return [];

    const ids = [employee.id];

    for (const child of employee.children) {
      const childIds = await this.getEmployeeTreeIds(child.id);
      ids.push(...childIds);
    }

    return ids;
  }


  // جلب سلسلة الموظفين للأعلى (الأب → الجد ...)
  async getEmployeeHierarchy(employeeId: string): Promise<string[]> {
    const employee = await this.repo.findOne({
      where: { id: employeeId },
      relations: ['parent'],
    });

    if (!employee) return [];

    // إذا ما عنده parent فهو الأعلى
    if (!employee.parent) {
      return [employee.name];
    }

    // اجلب السلسلة للأعلى ثم أضف هذا الموظف بالنهاية
    const hierarchy = await this.getEmployeeHierarchy(employee.parent.id);
    hierarchy.push(employee.name);

    return hierarchy;
  }

  // جلب سلاسة الموظفين للأعلى كأهداف (أب → جد ...) مع الـ FCM Tokens
  async getAncestors(employeeId: string): Promise<Employee[]> {
    const ancestors: Employee[] = [];
    let currentId = employeeId;

    while (currentId) {
      const employee = await this.repo.findOne({
        where: { id: currentId },
        relations: ['parent'],
      });

      if (!employee || !employee.parent) break;

      const parent = await this.repo.findOne({
        where: { id: employee.parent.id },
      });

      if (parent) {
        ancestors.push(parent);
        currentId = parent.id;
      } else {
        break;
      }
    }

    return ancestors;
  }





  // جلب سلسلة الموظفين للأعلى (الأب → الجد ...) فقط اسم مستخدم لوصل الطلبات
  async getEmployeeHierarchyUserName(employeeId: string): Promise<string[]> {
    const employee = await this.repo.findOne({
      where: { id: employeeId },
      relations: ['parent'],
    });

    if (!employee) return [];

    // إذا ما عنده parent فهو الأعلى
    if (!employee.parent) {
      return [employee.username];
    }

    // اجلب السلسلة للأعلى ثم أضف هذا الموظف بالنهاية
    const hierarchy = await this.getEmployeeHierarchyUserName(employee.parent.id);
    hierarchy.push(employee.username);

    return hierarchy;
  }



  //   /** -----------------------------------------------------------
  //  *  جلب كل موظفين الهرم بدون الموظف الأب
  //  * ------------------------------------------------------------ */
  //   async getEmployeeHierarchyExcludingRoot(rootEmployeeId: string): Promise<string[]> {
  //     const ids: string[] = [];

  //     const traverse = async (empId: string) => {
  //       const emp = await this.repo.findOne({
  //         where: { id: empId },
  //         relations: ['children'],
  //       });
  //       if (!emp) return;

  //       // لا نضيف الموظف الأب
  //       if (emp.id !== rootEmployeeId) {
  //         ids.push(emp.id);
  //       }

  //       if (emp.children?.length) {
  //         for (const child of emp.children) {
  //           await traverse(child.id);
  //         }
  //       }
  //     };

  //     await traverse(rootEmployeeId);
  //     return ids;
  //   }



  async getEmployeesAddedBy(
    employeeId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    const [employees, total] = await this.repo.findAndCount({
      where: {
        parent: { id: employeeId },
      },
      relations: ['parent'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const formatted = employees.map((emp) => ({
      ...emp,
      addedBy: emp.parent ? emp.parent.username : null,
    }));

    return {
      data: formatted,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }







  async exportEmployeesExcel(ids: string[]) {
    const where = ids.length ? { id: In(ids) } : {};

    const employees = await this.repo.find({
      where,
      relations: ['parent'],
      order: { createdAt: 'DESC' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Havana System';

    const sheet = workbook.addWorksheet('الموظفين', {
      views: [{ rightToLeft: true }],
    });

    // صف فارغ
    sheet.addRow([]);

    // العنوان
    const titleRow = sheet.addRow(['سجل الموظفين']);
    titleRow.font = { bold: true, size: 16 };
    sheet.mergeCells('A2:H2');
    titleRow.alignment = { horizontal: 'center' };

    sheet.addRow([]);

    // رؤوس الأعمدة
    sheet.addRow([
      'رقم',
      'الاسم',
      'اسم المستخدم',
      'الدور الوظيفي',
      'المشرف المباشر',
      'الحالة',
      'تاريخ الإنشاء',
      'آخر تحديث',
    ]);

    const header = sheet.getRow(sheet.lastRow.number);
    header.font = { bold: true, size: 12 };
    header.alignment = { horizontal: 'center' };

    // البيانات
    employees.forEach((emp, index) => {
      sheet.addRow([
        index + 1,
        emp.name,
        emp.username,
        this.mapRoleToArabic(emp.role),
        emp.parent?.name || '—',
        emp.isBlocked ? 'محظور' : 'نشط',
        emp.createdAt.toLocaleString('ar-EG'),
        emp.updatedAt.toLocaleString('ar-EG'),
      ]);
    });

    // عرض الأعمدة
    sheet.columns = [
      { width: 8 },
      { width: 20 },
      { width: 20 },
      { width: 18 },
      { width: 20 },
      { width: 12 },
      { width: 22 },
      { width: 22 },
    ];

    return workbook.xlsx.writeBuffer();
  }


  async saveFcmToken(employeeId: string, token: string) {
    if (!token) {
      throw new BadRequestException('FCM token is required');
    }

    const employee = await this.repo.findOne({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    employee.fcmTokens = employee.fcmTokens ?? [];

    // منع التكرار
    if (!employee.fcmTokens.includes(token)) {
      employee.fcmTokens.push(token);
      await this.repo.save(employee);
    }

    return { message: 'FCM token saved successfully' };
  }


  async removeFcmToken(employeeId: string | null, token: string) {
    if (!token) return;

    let employee;
    if (employeeId) {
      employee = await this.repo.findOne({ where: { id: employeeId } });
    } else {
      employee = await this.repo.createQueryBuilder('employee')
        .where(':token = ANY(string_to_array(employee.fcmTokens, \',\'))', { token })
        .getOne();
    }

    if (employee && employee.fcmTokens) {
      employee.fcmTokens = employee.fcmTokens.filter(t => t !== token);
      await this.repo.save(employee);
    }
  }




  async deleteEmployeeTreeByAdmin(targetEmployeeId: string) {
    // 1️⃣ جلب كل الموظف + كل من تحته
    const idsToDelete = await this.getEmployeeTreeIds(targetEmployeeId);

    if (!idsToDelete.length) {
      throw new NotFoundException('Employee not found');
    }

    // 2️⃣ حذف جماعي
    await this.repo.delete({
      id: In(idsToDelete),
    });

    return {
      message: 'Employee and subordinates deleted successfully',
      deletedCount: idsToDelete.length,
      ids: idsToDelete,
    };
  }




  async deleteEmployeeTree(requesterId: string, targetId: string) {
    // 1) اجلب IDs الخاصة بشجرة الموظف الذي قام بالطلب
    const requesterTreeIds = await this.getEmployeeTreeIds(requesterId);

    // الموظف الهدف يجب أن يكون تحت requester
    if (!requesterTreeIds.includes(targetId)) {
      throw new ForbiddenException(
        'You are not allowed to delete an employee outside your hierarchy',
      );
    }

    // 2) اجلب كل IDs للموظف المستهدف + كل الموظفين تحته (سلسلة كاملة)
    const idsToDelete = await this.getEmployeeTreeIds(targetId);

    if (!idsToDelete.length) {
      throw new NotFoundException('Employee not found');
    }

    // 3) نفّذ حذف كامل السلسلة دفعة واحدة
    await this.repo.delete(idsToDelete);

    return {
      message: 'Employee and full tree deleted successfully',
      deletedCount: idsToDelete.length,
      ids: idsToDelete,
    };
  }



  async blockEmployeeTree(targetEmployeeId: string) {
    // 1) جلب جميع IDs (الموظف + كل من تحته)
    const idsToBlock = await this.getEmployeeTreeIds(targetEmployeeId);

    if (!idsToBlock.length) {
      throw new NotFoundException('Employee not found');
    }

    // 2) تنفيذ الحظر الجماعي
    await this.repo.update(
      { id: In(idsToBlock) },
      { isBlocked: true }
    );

    return {
      message: 'Employee and subordinates blocked successfully',
      blockedCount: idsToBlock.length,
      ids: idsToBlock,
    };
  }

  async unblockEmployeeTree(targetEmployeeId: string) {
    const idsToUnblock = await this.getEmployeeTreeIds(targetEmployeeId);

    if (!idsToUnblock.length) {
      throw new NotFoundException('Employee not found');
    }

    await this.repo.update(
      { id: In(idsToUnblock) },
      { isBlocked: false }
    );

    return {
      message: 'Employee and subordinates unblocked successfully',
      unblockedCount: idsToUnblock.length,
      ids: idsToUnblock,
    };
  }





  private mapRoleToArabic(role: string): string {
    switch (role) {
      case 'ADMIN':
        return 'مدير النظام';
      case 'MANAGER':
        return 'مدير';
      case 'LEADER':
        return 'قائد';
      case 'SUPERVISOR':
        return 'مشرف';
      case 'REP':
        return 'مندوب';
      case 'PROCESSOR':
        return 'معالج';
      default:
        return role;
    }
  }

  async findAssignedToCustomer(customerId: string) {
    console.log(`[DEBUG] findAssignedToCustomer called for ID: ${customerId}`);
    const customer = await this.customerRepo.findOne({
      where: { id: customerId },
      relations: ['employee'],
    });

    if (!customer) {
      console.log(`[DEBUG] Customer not found for ID: ${customerId}`);
      throw new NotFoundException('Customer not found');
    }

    if (!customer.employee) {
      console.log(`[DEBUG] No employee assigned to customer: ${customer.name}`);
      throw new NotFoundException('No employee assigned to this customer');
    }

    console.log(`[DEBUG] Assigned employee for ${customer.name} is ${customer.employee.name} (${customer.employee.whatsapp})`);
    return customer.employee;
  }

  async getWhatsAppByReferralCode(code: string) {
    const employee = await this.repo.findOne({
      where: [
        { referralCode: code },
        { username: code }
      ],
      select: { whatsapp: true },
    });
    return employee?.whatsapp || null;
  }

  /** -----------------------------------
   * توليد تقرير PDF للموظف
   * ----------------------------------- */
  async generateEmployeeReportPdf(id: string): Promise<Buffer> {
    const employee = await this.repo.findOne({
      where: { id },
      relations: ['parent'],
    });

    if (!employee) throw new NotFoundException('Employee not found');

    // جلب الإحصائيات (إجمالي مبيعات، نقاط، طلبيات مسلمة)
    const stats = await this.statisticsService.getStatisticsForEmployeeHierarchy(id);

    // QR Code لرابط الموظف أو هويته
    const qrCode = await QRCode.toDataURL(employee.id);

    // تحميل القالب
    let templatePath = path.join(__dirname, 'templates', 'employee-report.template.html');
    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(process.cwd(), 'src', 'employee', 'templates', 'employee-report.template.html');
    }

    const templateHtml = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateHtml);

    const html = template({
      name: employee.name,
      username: employee.username,
      role: employee.role,
      whatsapp: employee.whatsapp || 'غير متوفر',
      status: employee.isBlocked ? 'محظور' : 'نشط',
      addedBy: employee.parent ? employee.parent.name : 'النظام (Admin)',
      joinDate: employee.createdAt?.toLocaleDateString('ar-EG'),
      referralCode: employee.referralCode || 'لا يوجد',
      totalSales: (stats.netAmount || 0).toLocaleString('en-US'),
      totalPoints: stats.warehousePoints || '0',
      deliveredOrders: stats.orderStatusCount?.DELIVERED || 0,
      exportDate: new Date().toLocaleDateString('ar-EG'),
      qrCode,
    });

    const browser = await chromium.launch({
      headless: true,
      args: process.platform === 'linux' ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });

    await browser.close();
    return Buffer.from(pdfBuffer);
  }
}
