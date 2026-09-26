import { initializeApp, getApps } from 'firebase-admin/app';

if (getApps().length === 0) {
  initializeApp();
}

export { syncPreferencesToDevices } from './sync-preferences-to-devices';
export { sendNotification } from './send-notification';
export { onPreferencesWrite } from './triggers/onPreferencesWrite.ts';
export { deleteAccount } from './delete-account';
export { onUserProfileWrite } from './triggers/onUserProfileWrite.ts';
export { claimRun } from './claim-run.ts';
