export enum UserType {
    ADMIN = 'ADMIN',
    LEADER = 'LEADER',
    MANAGER = 'MANAGER',
    SUPERVISOR = 'SUPERVISOR',
    REP = 'REP',
    PROCESSOR = 'PROCESSOR',
    CUSTOMER = 'CUSTOMER',
}

export enum EmployeeRole {
    LEADER = 'LEADER',
    MANAGER = 'MANAGER',
    SUPERVISOR = 'SUPERVISOR',
    REP = 'REP',
    PROCESSOR = 'PROCESSOR',
}


export enum OrderSource {
    EMPLOYEE_APP = 'EMPLOYEE_APP',   // برنامج الموظفين
    STORE_APP = 'STORE_APP',         // برنامج المتجر
    STORE_WEBSITE = 'STORE_WEBSITE', // موقع المتجر
}
