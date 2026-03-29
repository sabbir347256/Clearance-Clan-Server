import 'dotenv/config';
import admin, { sendPushNotification } from './src/config/firebase';

async function test() {
  const token = process.env.FIREBASE_TEST_TOKEN;
  if (!token) {
    console.error('FIREBASE_TEST_TOKEN is not set in .env');
    process.exit(1);
  }

  // ensure admin SDK initialized by importing default
  console.log('Firebase admin initialized:', !!admin.apps.length);

  const results = await sendPushNotification([token], {
    title: 'Test',
    body: 'Firebase test',
    data: { test: '1' }
  });

  console.log('sendPushNotification results:', results);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
