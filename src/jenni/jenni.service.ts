
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Order } from '../order/entities/order.entity';
import { OrderStatus } from '../utils/order-status.enum';

@Injectable()
export class JenniService {
    private readonly logger = new Logger(JenniService.name);

    private readonly apiUrl: string;
    private readonly apiToken: string;
    private readonly systemCode: string;

    constructor(private configService: ConfigService) {
        this.apiUrl =
            this.configService.get<string>('JENNI_API_URL')?.trim() || '';

        this.apiToken =
            this.configService.get<string>('JENNI_API_TOKEN')?.trim() || '';

        this.systemCode =
            this.configService.get<string>('JENNI_SYSTEM_CODE')?.trim() || '';

        if (!this.apiUrl) {
            throw new Error('JENNI_API_URL is not configured');
        }

        if (!this.apiToken) {
            throw new Error('JENNI_API_TOKEN is not configured');
        }

        if (!this.systemCode) {
            throw new Error('JENNI_SYSTEM_CODE is not configured');
        }
    }

    /**
     * Read response safely as JSON or text.
     */
    private async safeJson(response: Response): Promise<any> {
        const text = await response.text();

        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    /**
     * Static Bearer Token authentication.
     *
     * Jenni expects:
     * Authorization: Bearer <token>
     */
    private getHeaders(): Record<string, string> {
        return {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
    }

    async createShipment(order: Order) {
        try {
            this.logger.log(
                `Creating shipment for order #${order.id} on Jenni`,
            );

            const payload = {
                system_code: this.systemCode,

                shipments: [
                    {
                        shipment_number: `${order.orderNumber}`,
                        external_shipment_id: order.id.toString(),

                        receiver_name: order.customerName,
                        receiver_phone_1: order.customerPhone,
                        receiver_phone_2: order.customerPhone2 || null,

                        governorate_code: this.mapGovernorate(
                            order.governorate,
                        ),

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
                            order.items
                                ?.map(
                                    item =>
                                        `${item.productName} (x${item.quantity})`,
                                )
                                .join(' - ') || 'منتجات متنوعة',

                        note: order.notes || '',
                    },
                ],
            };

            const response = await fetch(
                `${this.apiUrl}/v2/shipments/create`,
                {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify(payload),
                },
            );

            const data = await this.safeJson(response);

            if (!response.ok) {
                const errorMessage =
                    typeof data === 'string'
                        ? data
                        : JSON.stringify(data);

                this.logger.error(
                    `Failed to create shipment on Jenni ` +
                    `(Status: ${response.status}): ${errorMessage}`,
                );

                return null;
            }

            this.logger.log(
                `Shipment created successfully for order #${order.id}`,
            );

            return data;
        } catch (error: any) {
            this.logger.error(
                `Error creating shipment on Jenni: ${error.message}`,
            );

            return null;
        }
    }

    private mapGovernorate(name: string): string {
        const govMap: Record<string, string> = {
            // Arabic
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

            // English
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

        if (!name) {
            return name;
        }

        const normalizedName = name.trim();

        return govMap[normalizedName] || normalizedName;
    }

    mapJenniStatus(
        actionCode: string,
    ): OrderStatus | 'SKIPPED' | null {
        if (!actionCode) {
            return null;
        }

        const code = actionCode.toUpperCase();

        switch (code) {
            // Delivered
            case 'DELIVERED':
            case 'FORCE_DELIVERY':
            case 'SUCCESSFUL_DELIVERY':
                return OrderStatus.DELIVERED;

            // Returned
            case 'RETURN_TO_STORE':
                return OrderStatus.RETURNED;

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

            // Processing
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

            // No status change
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

            default:
                return null;
        }
    }
}

