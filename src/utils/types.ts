export type JWTPayload = {
    sub: string;       // id المستخدم
    username: string;  // اسم المستخدم
    role: string;      // دور المستخدم
    createdAt: string; // تاريخ إنشاء المستخدم
    userType: string;  // نوع المستخدم (ADMIN, EMPLOYEE, CUSTOMER)
};


// export type AccessToken = {
//     access_token: string;
// }
// export type RefreshToken = {
//     refresh_token: string;
// }

// export type UserToken = {
//     access_token: string;
//     refresh_token: string;
// }


// export interface ApiResponse {
//     success: boolean;
//     data?: any;
//     error?: {
//         message: string;
//         field?: string;
//         code?: string;
//     };
// }


