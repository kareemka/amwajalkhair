// import { Injectable, OnModuleInit } from '@nestjs/common';
// import * as admin from 'firebase-admin';
// import * as serviceAccount from './firebase-admin.json';

// @Injectable()
// export class FirebaseService implements OnModuleInit {
//   onModuleInit() {
//     if (!admin.apps.length) {
//       admin.initializeApp({
//         credential: admin.credential.cert(
//           serviceAccount as admin.ServiceAccount,
//         ),
//       });
//     }
//   }

//   async sendToToken(
//     token: string,
//     title: string,
//     body: string,
//     data?: Record<string, string>,
//   ) {
//     return admin.messaging().send({
//       token,
//       notification: { title, body },
//       data,
//     });
//   }

//   async sendToMultipleTokens(
//     tokens: string[],
//     title: string,
//     body: string,
//     data?: Record<string, string>,
//   ) {
//     return admin.messaging().sendEachForMulticast({
//       tokens,
//       notification: { title, body },
//       data,
//     });
//   }
// }
