import * as admin from 'firebase-admin';

export function initFirebaseEmployees() {
    if (admin.apps.find(app => app.name === 'employees')) return;

    admin.initializeApp(
        {
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_EMP_PROJECT_ID,
                clientEmail: process.env.FIREBASE_EMP_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_EMP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        },
        'employees',
    );

    console.log('🔥 Firebase Employees Initialized');
}
