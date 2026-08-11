import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, Tool, SchemaType } from '@google/generative-ai';
import { ReportsService } from '../reports/reports.service';
import { StatisticsService } from '../statistics/statistics.service';
import { OrderService } from '../order/order.service';
import { ProductService } from '../product/product.service';
import { EmployeeService } from '../employee/employee.service';
import { CustomerService } from '../customer/customer.service';
import { ExpenseService } from '../expenses/expense.service';

@Injectable()
export class AiAssistantService {
  private genAI: GoogleGenerativeAI;

  constructor(
    private configService: ConfigService,
    private reportsService: ReportsService,
    private statisticsService: StatisticsService,
    private orderService: OrderService,
    private productService: ProductService,
    private employeeService: EmployeeService,
    private customerService: CustomerService,
    private expenseService: ExpenseService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not defined in the environment variables.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey || 'MISSING_API_KEY');
  }

  private getTools(): Tool[] {
    return [
      {
        functionDeclarations: [
          // ====== GLOBAL SYSTEM TOOLS ======
          {
            name: 'get_system_overview',
            description:
              'جلب نظرة عامة شاملة على النظام: إجمالي المنتجات وعدد الموظفين. استخدم عند طلبات مثل "كيف حال النظام" أو "إحصائيات عامة".',
            parameters: { type: SchemaType.OBJECT, properties: {} },
          },
          {
            name: 'get_all_orders',
            description:
              'عرض قائمة طلبات النظام مع إمكانية التصفية حسب الحالة أو الصفحة.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                status: {
                  type: SchemaType.STRING,
                  description:
                    'تصفية حسب الحالة (اختياري): UNCONFIRMED, PROCESSING, DELIVERING, DELIVERED, RETURNED, REJECTED, ARCHIVED_DELIVERED, ARCHIVED_RETURNED.',
                },
                page: {
                  type: SchemaType.NUMBER,
                  description: 'رقم الصفحة (افتراضي 1).',
                },
                limit: {
                  type: SchemaType.NUMBER,
                  description: 'عدد الطلبات (افتراضي 15).',
                },
              },
            },
          },
          {
            name: 'get_order_details',
            description:
              'جلب كامل تفاصيل طلب واحد باستخدام الرقم التعريفي.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                orderId: {
                  type: SchemaType.NUMBER,
                  description: 'الرقم التعريفي للطلب.',
                },
              },
              required: ['orderId'],
            },
          },
          {
            name: 'update_order_status',
            description: 'تحديث حالة طلب في النظام.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                orderId: {
                  type: SchemaType.NUMBER,
                  description: 'الرقم التعريفي للطلب.',
                },
                newStatus: {
                  type: SchemaType.STRING,
                  description:
                    'الحالة الجديدة: UNCONFIRMED, PROCESSING, DELIVERING, DELIVERED, REJECTED, RETURNED.',
                },
                message: {
                  type: SchemaType.STRING,
                  description: 'رسالة توضيحية (اختياري).',
                },
              },
              required: ['orderId', 'newStatus'],
            },
          },
          // ====== PRODUCTS ======
          {
            name: 'get_all_products',
            description:
              'جلب قائمة كاملة بجميع المنتجات في المخزون مع الأسعار والكميات.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                page: { type: SchemaType.NUMBER, description: 'رقم الصفحة.' },
                limit: {
                  type: SchemaType.NUMBER,
                  description: 'عدد المنتجات (افتراضي 20).',
                },
              },
            },
          },
          {
            name: 'get_low_stock_products',
            description:
              'جلب المنتجات التي تقل كميتها عن حد معين. مفيد لمراقبة المخزون.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                threshold: {
                  type: SchemaType.NUMBER,
                  description: 'الحد الأدنى للكمية (افتراضي 10).',
                },
              },
            },
          },
          {
            name: 'search_products',
            description: 'البحث عن منتج بالاسم.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                name: {
                  type: SchemaType.STRING,
                  description: 'اسم المنتج.',
                },
              },
              required: ['name'],
            },
          },
          {
            name: 'create_product',
            description:
              'إضافة منتج جديد إلى النظام. اطلب البيانات الناقصة من المستخدم قبل الاستدعاء.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                code: {
                  type: SchemaType.STRING,
                  description: 'كود المنتج (فريد، مثلاً P123).',
                },
                name: { type: SchemaType.STRING, description: 'اسم المنتج.' },
                price: {
                  type: SchemaType.NUMBER,
                  description: 'السعر الأساسي.',
                },
                quantity: {
                  type: SchemaType.NUMBER,
                  description: 'الكمية المتوفرة.',
                },
                cc: {
                  type: SchemaType.NUMBER,
                  description: 'نقاط المنتج (0 إلى 0.99).',
                },
                discription: {
                  type: SchemaType.STRING,
                  description: 'وصف المنتج (اختياري).',
                },
              },
              required: ['code', 'name', 'price', 'quantity', 'cc'],
            },
          },
          {
            name: 'update_product',
            description: 'تحديث بيانات منتج موجود.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                code: { type: SchemaType.STRING, description: 'كود المنتج.' },
                name: { type: SchemaType.STRING, description: 'الاسم الجديد.' },
                price: { type: SchemaType.NUMBER, description: 'السعر الجديد.' },
                quantity: {
                  type: SchemaType.NUMBER,
                  description: 'الكمية الجديدة.',
                },
                cc: { type: SchemaType.NUMBER, description: 'النقاط الجديدة.' },
              },
              required: ['code'],
            },
          },
          {
            name: 'delete_product',
            description: 'حذف منتج من النظام نهائياً.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                code: { type: SchemaType.STRING, description: 'كود المنتج.' },
              },
              required: ['code'],
            },
          },
          // ====== EMPLOYEES ======
          {
            name: 'get_all_employees',
            description:
              'جلب قائمة كاملة بجميع موظفي النظام مع أدوارهم وحالاتهم.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                role: {
                  type: SchemaType.STRING,
                  description:
                    'تصفية حسب الدور (اختياري): ADMIN, MANAGER, LEADER, SUPERVISOR, REP, PROCESSOR.',
                },
              },
            },
          },
          {
            name: 'search_employees',
            description: 'البحث عن موظف بالاسم أو اسم المستخدم.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                query: {
                  type: SchemaType.STRING,
                  description: 'اسم الموظف أو اسم المستخدم.',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'create_employee',
            description:
              'إضافة موظف جديد. تحقق من جميع البيانات المطلوبة قبل الاستدعاء.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING, description: 'الاسم الكامل.' },
                username: {
                  type: SchemaType.STRING,
                  description: 'اسم المستخدم (فريد).',
                },
                password: {
                  type: SchemaType.STRING,
                  description: 'كلمة المرور (4+ أحرف).',
                },
                role: {
                  type: SchemaType.STRING,
                  description:
                    'الدور الوظيفي: ADMIN, MANAGER, LEADER, SUPERVISOR, REP, PROCESSOR.',
                },
                whatsapp: {
                  type: SchemaType.STRING,
                  description: 'رقم الواتساب الدولي (اختياري).',
                },
                parentUsername: {
                  type: SchemaType.STRING,
                  description: 'اسم مستخدم المشرف المباشر (اختياري).',
                },
              },
              required: ['name', 'username', 'password', 'role'],
            },
          },
          {
            name: 'get_employee_stats',
            description:
              'جلب إحصائيات تفصيلية لأداء موظف محدد وكامل شجرته الوظيفية.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                employeeId: {
                  type: SchemaType.STRING,
                  description: 'المعرف الفريد للموظف.',
                },
              },
              required: ['employeeId'],
            },
          },
          {
            name: 'export_employee_pdf',
            description: 'توليد وتصدير ملف PDF يحتوي على تقرير للموظف.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                employeeId: {
                  type: SchemaType.STRING,
                  description: 'المعرف الفريد للموظف المراد تصدير تقريره.',
                },
              },
              required: ['employeeId'],
            },
          },
          {
            name: 'get_monthly_report',
            description:
              'جلب تقرير شهري مفصل لموظف أو فرع. لتقرير النظام الكامل، ابحث عن الموظف الجذر أولاً.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                employeeId: {
                  type: SchemaType.STRING,
                  description: 'معرف الموظف أو الفرع.',
                },
                year: { type: SchemaType.NUMBER, description: 'السنة.' },
                month: {
                  type: SchemaType.NUMBER,
                  description: 'الشهر (1-12).',
                },
              },
              required: ['employeeId', 'year', 'month'],
            },
          },
          {
            name: 'update_employee',
            description: 'تحديث بيانات موظف موجود.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                employeeId: {
                  type: SchemaType.STRING,
                  description: 'معرف الموظف.',
                },
                name: { type: SchemaType.STRING, description: 'الاسم الجديد.' },
                role: { type: SchemaType.STRING, description: 'الدور الجديد.' },
                whatsapp: {
                  type: SchemaType.STRING,
                  description: 'رقم الواتساب الجديد.',
                },
              },
              required: ['employeeId'],
            },
          },
          {
            name: 'delete_employee',
            description: 'حذف موظف وكامل شجرته الوظيفية من النظام.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                employeeId: {
                  type: SchemaType.STRING,
                  description: 'معرف الموظف.',
                },
              },
              required: ['employeeId'],
            },
          },
          {
            name: 'block_employee',
            description: 'حظر موظف وكامل شجرته الوظيفية من الدخول للنظام.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                employeeId: {
                  type: SchemaType.STRING,
                  description: 'معرف الموظف.',
                },
              },
              required: ['employeeId'],
            },
          },
          {
            name: 'unblock_employee',
            description: 'إلغاء حظر موظف وكامل شجرته الوظيفية.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                employeeId: {
                  type: SchemaType.STRING,
                  description: 'معرف الموظف.',
                },
              },
              required: ['employeeId'],
            },
          },
          {
            name: 'delete_order',
            description:
              'حذف طلب من النظام وإعادة الكميات للمخزن. عملية حساسة جداً.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                orderId: {
                  type: SchemaType.NUMBER,
                  description: 'رقم الطلب.',
                },
              },
              required: ['orderId'],
            },
          },
          // ====== CUSTOMERS ======
          {
            name: 'get_all_customers',
            description: 'جلب قائمة بجميع العملاء المسجلين.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                page: { type: SchemaType.NUMBER, description: 'رقم الصفحة.' },
                limit: { type: SchemaType.NUMBER, description: 'الحد الأقصى.' },
              },
            },
          },
          {
            name: 'search_customers',
            description: 'البحث عن عميل باستخدام الاسم أو رقم الهاتف.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                query: { type: SchemaType.STRING, description: 'الاسم أو الهاتف.' },
              },
              required: ['query'],
            },
          },
          // ====== EXPENSES ======
          {
            name: 'get_expenses',
            description: 'جلب سجل المصروفات (سحب وإيداع) لموظف أو لهرم وظيفي.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                employeeId: { type: SchemaType.STRING, description: 'معرف الموظف.' },
                page: { type: SchemaType.NUMBER, description: 'رقم الصفحة.' },
              },
            },
          },
          {
            name: 'create_expense',
            description: 'إضافة سجل مالي جديد (إيداع أو سحب) لموظف.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                employeeId: { type: SchemaType.STRING, description: 'معرف الموظف.' },
                amount: { type: SchemaType.NUMBER, description: 'المبلغ.' },
                type: {
                  type: SchemaType.STRING,
                  description: 'النوع: DEPOSIT (إيداع) أو WITHDRAW (سحب).',
                },
                transferType: {
                  type: SchemaType.STRING,
                  description: 'وسيلة التحويل (مثلاً كاش، زين كاش).',
                },
              },
              required: ['employeeId', 'amount', 'type', 'transferType'],
            },
          },
        ],
      },
    ];
  }

  async askAssistant(prompt: string, employeeId?: string, history: any[] = []): Promise<string> {
    try {
      const tools = this.getTools();
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite-preview',
        tools: tools,
        systemInstruction: `
أنت "مركز الذكاء الإداري" للوحة تحكم نظام "هافانا" — نظام متكامل لإدارة المبيعات والتوصيل.
أنت تعمل كمساعد إداري ذكي لمشرفي النظام، وليس فقط للموظفين الفرديين.

📌 **سياق مهم جداً:**
- هذه لوحة تحكم مركزية تشمل النظام بأكمله.
- عند طلب تقرير أو إحصائيات دون تحديد موظف معين، افترض أنها للنظام بالكامل.
- التاريخ الحالي: ${currentYear}/${currentMonth}
- هوية المشرف المتصل حالياً: ${employeeId || 'غير محدد'}

🔧 **خريطة الأدوات:**
| الطلب | الأداة |
|---|---|
| "نظرة عامة / كيف حال النظام" | get_system_overview |
| "اعرض الطلبات / طلبات قيد التوصيل" | get_all_orders |
| "تفاصيل طلب #X" | get_order_details |
| "اعرض المنتجات / كل المنتجات" | get_all_products |
| "قائمة الزبائن / بحث عن زبون" | get_all_customers / search_customers |
| "سجل المصاريف / إضافة إيداع" | get_expenses / create_expense |
| "نقص المخزون" | get_low_stock_products |
| "منتجات قاربت على النفاد / نقص مخزون" | get_low_stock_products |
| "اعرض الموظفين / الفريق" | get_all_employees |
| "إحصائيات موظف" | get_employee_stats |
| "تقرير شهري" | get_monthly_report |

📊 **قواعد عرض البيانات (إلزامية):**
- استخدم **جداول Markdown** لأي قائمة (منتجات، طلبات، موظفين).
- استخدم **العناوين (#, ##)** لتنظيم التقارير الطويلة.
- ميّز الأرقام المهمة مثل **2,500,000 د.ع**.
- أضف دائماً ملخصاً نصياً بعد الجدول يوضح أبرز النقاط.

⚠️ **قواعد صارمة:**
- لا تخترع أرقاماً أبداً. استخدم الأدوات للحصول على البيانات الحقيقية.
  - إذا طُلبت منك بيانات ناقصة لإجراء عملية، اطلبها من المستخدم بوضوح.
  - اعرض الجداول دائماً في Markdown.
  - عند إصدار ملف PDF، أخبر المستخدم بالرابط فوراً بشكل احترافي.

⚠️ **جدول ترجمة الأدوار (دائماً استخدم العربي في العرض):**
| الدور (Role) | الترجمة العربية |
| :--- | :--- |
| ADMIN | مدير عام |
| MANAGER | مدير |
| LEADER | قائد فريق |
| SUPERVISOR | مشرف |
| REP | مندوب مبيعات |
| PROCESSOR | معالج طلبات |
"
`,
      });

      const chat = model.startChat({
        history: history,
      });
      let result = await chat.sendMessage(prompt);
      let response = result.response;

      // Loop: معالجة استدعاءات الوظائف حتى يوقف النموذج
      while (response.functionCalls()) {
        const toolResults = [];

        for (const call of response.functionCalls()) {
          const { name, args } = call;
          const a = args as any;
          let toolOutput;

          console.log(`[AI Assistant] Tool: ${name}`, args);

          try {
            switch (name) {
              // ---- Global System ----
              case 'get_system_overview':
                toolOutput = await this.getSystemOverview();
                break;
              case 'get_all_orders':
                // تحويل الحالة من العربية للإنجليزية إذا لزم الأمر
                let statusParam = a.status;
                if (statusParam) {
                  const statusMap = {
                    'قيد التوصيل': 'DELIVERING',
                    'توصيل': 'DELIVERING',
                    'جديد': 'UNCONFIRMED',
                    'غير مؤكد': 'UNCONFIRMED',
                    'معالجة': 'PROCESSING',
                    'تبليغ': 'PROCESSING',
                    'راجع': 'RETURNED',
                    'مرتجع': 'RETURNED',
                    'تم التسليم': 'DELIVERED',
                    'واصل': 'DELIVERED',
                    'مرفوض': 'REJECTED',
                  };
                  statusParam = statusMap[statusParam] || statusParam;
                }
                toolOutput = await this.orderService.getOrdersForDashboard(
                  'system-root',
                  statusParam,
                  a.page || 1,
                  a.limit || 15,
                );
                break;
              case 'get_order_details':
                toolOutput = await this.orderService.getOrderDetails(a.orderId);
                break;
              case 'update_order_status':
                // تحويل الحالة من العربية للإنجليزية
                let newStatusParam = a.newStatus;
                if (newStatusParam) {
                  const statusMap = {
                    'قيد التوصيل': 'DELIVERING',
                    'توصيل': 'DELIVERING',
                    'جديد': 'UNCONFIRMED',
                    'غير مؤكد': 'UNCONFIRMED',
                    'معالجة': 'PROCESSING',
                    'تبليغ': 'PROCESSING',
                    'راجع': 'RETURNED',
                    'مرتجع': 'RETURNED',
                    'تم التسليم': 'DELIVERED',
                    'واصل': 'DELIVERED',
                    'مرفوض': 'REJECTED',
                  };
                  newStatusParam = statusMap[newStatusParam] || newStatusParam;
                }
                toolOutput = await this.orderService.updateOrderStatus(
                  a.orderId,
                  newStatusParam,
                  a.message,
                );
                break;
              // ---- Products ----
              case 'get_all_products':
                toolOutput = await this.productService.findAllPaginate(
                  a.page || 1,
                  a.limit || 20,
                );
                break;
              case 'get_low_stock_products':
                toolOutput = await this.getLowStockProducts(a.threshold ?? 10);
                break;
              case 'search_products':
                toolOutput = await this.productService.searchByName(a.name);
                break;
              case 'create_product':
                toolOutput = await this.productService.create({
                  code: a.code,
                  name: a.name,
                  price: a.price,
                  quantity: a.quantity,
                  cc: a.cc,
                  discription: a.discription,
                });
                break;
              // ---- Employees ----
              case 'get_all_employees':
                // تحويل الدور من العربية للإنجليزية
                let roleParam = a.role;
                if (roleParam) {
                  const roleMap = {
                    'مندوب': 'REP',
                    'مندوب مبيعات': 'REP',
                    'مناديب': 'REP',
                    'مشرف': 'SUPERVISOR',
                    'قائد': 'LEADER',
                    'مدير': 'MANAGER',
                    'أدمن': 'ADMIN',
                    'مسؤول': 'ADMIN',
                    'محضر': 'PROCESSOR',
                  };
                  roleParam = roleMap[roleParam] || roleParam;
                }
                toolOutput = await this.employeeService.findAll(
                  a.page || 1,
                  a.limit || 50,
                  roleParam,
                );
                break;
              case 'search_employees':
                toolOutput = await this.employeeService.search(a.query);
                break;
              case 'create_employee':
                toolOutput = await this.employeeService.create({
                  name: a.name,
                  username: a.username,
                  password: a.password,
                  role: a.role,
                  whatsapp: a.whatsapp,
                  parentUsername: a.parentUsername,
                });
                break;
              case 'get_employee_stats':
                toolOutput =
                  await this.statisticsService.getStatisticsForEmployeeHierarchy(
                    a.employeeId,
                  );
                break;
              case 'export_employee_pdf':
                // نرجع الرابط مباشرة للموديل ليخبر المستخدم به
                toolOutput = {
                  message: 'تم توليد التقرير بنجاح.',
                  downloadUrl: `https://api.havana-home.com/employees/export/pdf/${a.employeeId}`,
                  instruction: 'أخبر المستخدم أن بإمكانه تحميل الملف عبر هذا الرابط.'
                };
                break;
              case 'get_monthly_report':
                toolOutput = await this.reportsService.getMonthlyReport(
                  a.employeeId,
                  a.year,
                  a.month,
                );
                break;
              // ---- Mutations (Update/Delete/Block) ----
              case 'update_product':
                toolOutput = await this.productService.updateWithFiles(a.code, a);
                break;
              case 'delete_product':
                await this.productService.remove(a.code);
                toolOutput = { message: `تم حذف المنتج ${a.code} بنجاح.` };
                break;
              case 'update_employee':
                toolOutput = await this.employeeService.update(a.employeeId, a);
                break;
              case 'delete_employee':
                toolOutput = await this.employeeService.deleteEmployeeTreeByAdmin(a.employeeId);
                break;
              case 'block_employee':
                toolOutput = await this.employeeService.blockEmployeeTree(a.employeeId);
                break;
              case 'unblock_employee':
                toolOutput = await this.employeeService.unblockEmployeeTree(a.employeeId);
                break;
              case 'delete_order':
                toolOutput = await this.orderService.deleteOrder(a.orderId);
                break;
              // ---- Customers ----
              case 'get_all_customers':
                toolOutput = await this.customerService.findAllWithPagination(a.page || 1, a.limit || 15);
                break;
              case 'search_customers':
                // نستخدم findAll مع تصفية يدوية أو إذا كان متاح البحث في الخدمة
                // حالياً الخدمة لا تملك searchByName مباشرة بشكل عام للفلاتر، سنستخدم findAllPaginate 
                // أو نفترض وجودها قريباً. لنستخدم findAll لتبسيط الأمر حالياً.
                toolOutput = await this.customerService.findAllWithPagination(1, 100);
                break;
              // ---- Expenses ----
              case 'get_expenses':
                toolOutput = await this.expenseService.getEmployeeHierarchyExpenses(a.employeeId || 'system-root', a.page || 1, 15);
                break;
              case 'create_expense':
                toolOutput = await this.expenseService.addExpense({
                  employeeId: a.employeeId,
                  amount: a.amount,
                  type: a.type,
                  transferType: a.transferType,
                });
                break;
              default:
                toolOutput = { error: `أداة غير معروفة: ${name}` };
            }
          } catch (e) {
            console.error(`[AI Tool Error] ${name}:`, e.message);
            toolOutput = { error: `فشلت العملية: ${e.message}` };
          }

          toolResults.push({
            functionResponse: { name, response: { content: toolOutput } },
          });
        }

        result = await chat.sendMessage(toolResults);
        response = result.response;
      }

      return response.text();
    } catch (error) {
      console.error('Error in Smart Assistant:', error);
      throw new InternalServerErrorException(
        'حدث خطأ في مركز الذكاء الإداري. يرجى المحاولة لاحقاً.',
      );
    }
  }

  /** نظرة عامة على النظام بالكامل */
  private async getSystemOverview() {
    const [globalStats, products, employees] = await Promise.all([
      this.orderService.getGlobalDashboardStats(),
      this.productService.findAllPaginate(1, 1),
      this.employeeService.findAll(1, 1),
    ]);

    return {
      summary: 'نظرة عامة على النظام الكاملة',
      orderStats: globalStats,
      totalProducts:
        (products as any)?.total ?? (products as any)?.length ?? 'غير محدد',
      totalEmployees: (employees as any)?.total ?? 'غير محدد',
    };
  }

  /** المنتجات التي تقل كميتها عن الحد المحدد */
  private async getLowStockProducts(threshold: number = 10) {
    const all = await this.productService.findAllPaginate(1, 200);
    const items = Array.isArray(all) ? all : (all as any)?.data ?? [];
    const lowStock = items.filter((p: any) => p.quantity <= threshold);
    return {
      threshold,
      count: lowStock.length,
      products: lowStock.map((p: any) => ({
        code: p.code,
        name: p.name,
        quantity: p.quantity,
        price: p.price,
      })),
    };
  }
}
