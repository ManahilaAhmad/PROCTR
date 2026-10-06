import 'dotenv/config';
import { verifyEmailConnection } from './service/emailService.js';

try {
  await verifyEmailConnection();
  console.log('SMTP connection and Gmail authentication succeeded.');
} catch (error) {
  console.error('SMTP verification failed:');
  console.error(error.message);
  process.exitCode = 1;
}
