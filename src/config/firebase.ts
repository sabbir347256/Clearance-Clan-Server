import admin from 'firebase-admin';
import 'dotenv/config';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
    console.log('✅ Firebase Admin SDK initialized with credentials');
  } else {
    console.warn('⚠️  Firebase credentials not found in env. Push notifications will not work.');
    console.warn('   Set PROJECT_ID, CLIENT_EMAIL, and PRIVATE_KEY in your .env file');
    // Don't initialize to avoid silent failures
  }
}

export const sendPushNotification = async (
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> }
): Promise<Array<{ token: string; success: boolean; error?: any }>> => {
  const results: Array<{ token: string; success: boolean; error?: any }> = [];
  if (!tokens || tokens.length === 0) return results;

  const message = {
    notification: {
      title: payload.title,
      body: payload.body
    },
    data: payload.data || {},
  } as any;

  const chunkSize = 500;
  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);
    try {
      const resp = await (admin.messaging() as any).sendEachForMulticast({ tokens: chunk, notification: message.notification, data: message.data });
      // resp.responses aligns with chunk order
      resp.responses.forEach((r: any, idx: number) => {
        const token = chunk[idx];
        if (r.success) results.push({ token, success: true });
        else results.push({ token, success: false, error: r.error });
      });
    } catch (err: any) {
      console.error('FCM multicast error, falling back to per-token send', err);
      // Fall back to trying each token individually to identify invalid tokens
      for (const token of chunk) {
        try {
          await admin.messaging().send({ token, notification: message.notification, data: message.data });
          results.push({ token, success: true });
        } catch (e: any) {
          results.push({ token, success: false, error: e });
        }
      }
    }
  }

  return results;
};

export default admin;
// (server) Firebase Admin is exported as default above
