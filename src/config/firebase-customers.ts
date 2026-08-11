import * as admin from 'firebase-admin';

export function initFirebaseCustomers() {
    if (admin.apps.find(app => app.name === 'customers')) return;

    admin.initializeApp(
        {
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_CUST_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CUST_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_CUST_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        },
        'customers',
    );

    console.log('🔥 Firebase Customers Initialized');
}
