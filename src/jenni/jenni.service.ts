import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Order } from '../order/entities/order.entity';
import { OrderStatus } from '../utils/order-status.enum';

@Injectable()
export class JenniService {
    private readonly logger = new Logger(JenniService.name);
    private readonly apiUrl: string;
    private readonly username: string;
    private readonly password: string;
    private readonly systemCode: string;
    private token: string | null = null;
    private refreshToken: string | null = null;

    constructor(private configService: ConfigService) {
        this.apiUrl = this.configService.get<string>('JENNI_API_URL');
        this.username = this.configService.get<string>('JENNI_USERNAME');
        this.password = this.configService.get<string>('JENNI_PASSWORD');
        this.systemCode = this.configService.get<string>('JENNI_SYSTEM_CODE');
    }

    private async safeJson(response: Response) {
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    private async login(): Promise<string> {
        try {
            this.logger.log(`Attempting to login to Jenni API: ${this.apiUrl}/v2/auth/login`);
            const response = await fetch(`${this.apiUrl}/v2/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: this.username,
                    password: this.password,
                }),
            });

            const data = await this.safeJson(response);

            if (!response.ok) {
                this.logger.error(`Jenni login failed (Status: ${response.status}): ${typeof data === 'string' ? data : JSON.stringify(data)}`);
                throw new Error('Jenni login failed');
            }

            this.logger.log(`Jenni login successful. Response contains keys: ${Object.keys(data).join(', ')}`);
            this.token = data.token || data.accessToken || data.access_token;
            this.refreshToken = data.refreshToken || data.refresh_token;

            if (!this.token) {
                this.logger.error('Jenni login succeeded but no token was found in response');
            } else {
                this.logger.log(`New token set (length: ${this.token.length})`);
            }

            return this.token;
        } catch (error: any) {
            this.logger.error(`Error during Jenni login: ${error.message}`);
            throw error;
        }
    }

    private async refresh(): Promise<string> {
        if (!this.refreshToken) {
            this.logger.warn('No refresh token available, performing full login');
            return this.login();
        }

        try {
            this.logger.log('Attempting to refresh Jenni API token...');
            const response = await fetch(`${this.apiUrl}/v2/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refreshToken: this.refreshToken,
                }),
            });

            const data = await this.safeJson(response);

            if (!response.ok) {
                this.logger.warn(`Jenni token refresh failed (Status: ${response.status}): ${typeof data === 'string' ? data : JSON.stringify(data)}, falling back to login`);
                return this.login();
            }

            this.logger.log(`Jenni token refresh successful. Response contains keys: ${Object.keys(data).join(', ')}`);
            this.token = data.token || data.accessToken || data.access_token;
            this.refreshToken = data.refreshToken || data.refresh_token;

            return this.token;
        } catch (error: any) {
            this.logger.error(`Error during Jenni token refresh: ${error.message}`);
            return this.login();
        }
    }

    private async getHeaders() {
        if (!this.token) {
            await this.login();
        }
        return {
            'Authorization': `${this.token}`,
            'Content-Type': 'application/json',
        };
    }

   


    async createShipment(order: Order) {
    try {
        this.logger.log(`Creating shipment for order #${order.id} on Jenni`);
        let headers = await this.getHeaders();

        const payload = {
            system_code: this.systemCode,
            shipments: [
                {
                    shipment_number: `${order.orderNumber}`,
                    external_shipment_id: order.id.toString(),
                    receiver_name: order.customerName,
                    receiver_phone_1: order.customerPhone,
                    receiver_phone_2: order.customerPhone2 || null,
                    governorate_code: this.mapGovernorate(order.governorate),
                    city: order.district,
                    address: order.area,
                    amount_iqd: Number(order.totalAmount),
                    amount_usd: 0,
                    quantity: 1,
                    is_proof_of_delivery: false,
                    is_fragile: false,
                    have_return_item: false,
                    is_special_case: false,
                    product_info:
                        order.items?.map(item => `${item.productName} (x${item.quantity})`).join(' - ')
                        || "منتجات متنوعة",
                    note: order.notes || '',
                },
            ],
        };

        let response = await fetch(`${this.apiUrl}/v2/shipments/create`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        // 🔁 محاولة refresh إذا token انتهى
        if (!response.ok && (response.status === 401 || response.status === 403)) {
            this.logger.warn(`Jenni API returned ${response.status}. Attempting token refresh...`);
            await this.refresh();
            headers = await this.getHeaders();

            response = await fetch(`${this.apiUrl}/v2/shipments/create`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });
        }

        // ❌ إذا فشل → نكسر العملية
        if (!response.ok) {
            const error = await this.safeJson(response);
            const errorMessage =
                typeof error === 'string' ? error : JSON.stringify(error);

            this.logger.error(
                `Failed to create shipment on Jenni (Status: ${response.status}): ${errorMessage}`
            );

            // reset token إذا المشكلة منه
            if (
                errorMessage.toLowerCase().includes('token') &&
                (errorMessage.toLowerCase().includes('expire') ||
                 errorMessage.toLowerCase().includes('invalid'))
            ) {
                this.token = null;
                this.refreshToken = null;
            }

            throw new Error(`Jenni shipment failed: ${errorMessage}`); // 🔥 أهم تعديل
        }

        const result = await response.json();
        this.logger.log(
            `Shipment created successfully for order #${order.id}: ${JSON.stringify(result)}`
        );

        return result;

    } catch (error: any) {
        this.logger.error(`Error creating shipment on Jenni: ${error.message}`);

        throw error; // 🔥 لا ترجع null
    }
}



    private mapGovernorate(name: string): string {
        const govMap: Record<string, string> = {
            'الأنبار': 'ANB',
            'أربيل': 'ARB',
            'البصرة': 'BAS',
            'بابل': 'BBL',
            'بغداد': 'BGD',
            'ذي قار': 'DHI',
            'دهوك': 'DOH',
            'ديالى': 'DYL',
            'كربلاء': 'KRB',
            'كركوك': 'KRK',
            'المثنى': 'MTH',
            'ميسان': 'MYS',
            'نينوى': 'NIN',
            'النجف': 'NJF',
            'القادسية': 'QAD',
            'صلاح الدين': 'SAH',
            'السليمانية': 'SMH',
            'واسط': 'WST',
            // English variants
            'anbar': 'ANB',
            'erbil': 'ARB',
            'basra': 'BAS',
            'basrah': 'BAS',
            'babylon': 'BBL',
            'baghdad': 'BGD',
            'dhi qar': 'DHI',
            'duhok': 'DOH',
            'diyala': 'DYL',
            'karbala': 'KRB',
            'kirkuk': 'KRK',
            'muthanna': 'MTH',
            'maysan': 'MYS',
            'nineveh': 'NIN',
            'najaf': 'NJF',
            'qadisiyyah': 'QAD',
            'salah al-din': 'SAH',
            'sulaymaniyah': 'SMH',
            'wasit': 'WST',
        };

        return govMap[name.trim()] || name;
    }

    mapJenniStatus(actionCode: string): OrderStatus | 'SKIPPED' | null {
        const code = actionCode.toUpperCase();

        switch (code) {
            // Delivered
            case 'DELIVERED':
            case 'FORCE_DELIVERY':
            case 'SUCCESSFUL_DELIVERY':
                return OrderStatus.DELIVERED;

            // case 'DELIVERED_ARCHIVED':
            //     return OrderStatus.ARCHIVED_DELIVERED;

            // Returned
            case 'RETURN_TO_STORE':
                return OrderStatus.RETURNED;

            // case 'RTO_ARCHIVED':
            //     return OrderStatus.ARCHIVED_RETURNED;

            // Delivering / In Progress
            case 'OFD':
            case 'ASSIGN_TO_AGENT':
            case 'MOVE_TO_AGENT':
            case 'CHANGE_AGENT':
            case 'PRICE_CHANGE_APPROVED':
            case 'PRINT_MANIFEST_DA':
            case 'IN_SC':
            case 'NEW_WITH_PA':
            case 'WITH_MA':
            case 'NEW_IN_TRANSIT':
            case 'PICKED_UP':
                return OrderStatus.DELIVERING;

            // Processing / Treatment required

            case 'POSTPONED':
            case 'POSTPONED_CONFIRMED':
            case 'PARTIAL_DELIVERY':
            case 'PARTIALLY_DELIVERED':
            case 'DELIVERY_REATTEMPT':
            case 'PENDING_DELIVERY_APPROVAL':
            case 'REJECTED_PRICE_CHANGE':
            case 'TREATED':
            case 'DELIVERED_PRICE_CHANGED':
            case 'SUCCESSFUL_DELIVERY_WITH_AMOUNT_CHANGE':
            case 'RTO_WH':
            case 'RTO_CONFIRMED':
            case 'RETURNED_WITH_AGENT':
            case 'RTO_WITH_DA':
            case 'RTO_FROM_BRANCH':
            case 'RTO_IN_TRANSIT_WH':
            case 'RTO_READY_FOR_BRANCH':
                return OrderStatus.PROCESSING;


            case 'POSTPONEMENT_APPROVED':
            case 'ASSIGN_TO_LIAISON_AGENT':
            case 'BACK_TO_READY_FOR_PRINT':
            case 'DIRECT_ASSIGN_TO_AGENT':
            case 'MOVE_TO_SUCCESSFUL_DELIVERIES':
            case 'MOVE_TO_RETURNS_IN_STORE':
            case 'ERROR_RETURN_TO_AGENT':
            case 'FORCED_DELIVERY':
            case 'HANDOVER_TO_LIAISON_AGENT':
            case 'BACK_TO_RETURN_WITH_AGENT':
            case 'BACK_TO_STORE_FOR_RESEND':
            case 'RECEIVED_FROM_CLIENT':
            case 'READY_FOR_PICKUP':
            case 'MOVE_TO_ON_WAY':
            case 'MOVE_TO_STORE':
            case 'RECEIVE_AND_DIRECT_ASSIGN':
            case 'RECEIVED_FROM_LIAISON':
            case 'RESEND':
            case 'RETURN_TO_STORE_FOR_REASSIGNMENT':
            case 'RETURN_APPROVED':
            case 'RETURN_FROM_AGENT_TO_STORE':
            case 'RETURN_IN_STORE_WAITING_LIAISON':
            case 'RETURN_RECEIVED_FROM_LIAISON':
            case 'RETURN_READY_FOR_LIAISON':
            case 'RETURN_REFUSED_FROM_LIAISON':
            case 'RETURN_TO_LIAISON_AGENT':
            case 'RETURN_TO_AGENT':
            case 'MOVE_TO_IN_STORE':
                return 'SKIPPED';

            // No Status Change
            default:
                return null;
        }
    }
}
