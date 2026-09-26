import firestore from '@react-native-firebase/firestore';
import { primeAppCheck } from '@/services/app-check-prime';
import { parseProfile, type UserProfile } from './domain';

/**
 * users/{uid}.profile — the player profile. Rules: `isValidProfile`,
 * `isProfileStamped` and `isProfileChangeAllowed` in firestore.rules.
 *
 * Writes merge into the map, so a caller sends only what it is answering;
 * `updatedAt` is always the server's.
 */
const userRef = (uid: string) => firestore().collection('users').doc(uid);

export function watchProfile(
  uid: string,
  onChange: (profile: UserProfile | null) => void,
  onError: (error: Error) => void,
): () => void {
  return userRef(uid).onSnapshot(
    (snap) => onChange(parseProfile(snap.data())),
    onError,
  );
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  return parseProfile((await userRef(uid).get()).data());
}

/**
 * The profile as the server has it, falling back to the cache offline. For
 * deciding what to ask: a cached document from before another device set the
 * profile would ask it all again and overwrite that device's answers.
 */
export async function getProfileFresh(uid: string): Promise<UserProfile | null> {
  try {
    return await getProfileFromServer(uid);
  } catch {
    return getProfile(uid);
  }
}

/** The server's answer only; throws offline. For writes that must not trust the cache. */
export async function getProfileFromServer(uid: string): Promise<UserProfile | null> {
  return parseProfile((await userRef(uid).get({ source: 'server' })).data());
}

export async function saveProfile(uid: string, patch: Partial<UserProfile>): Promise<void> {
  await primeAppCheck();
  await userRef(uid).set(
    { profile: { ...patch, updatedAt: firestore.FieldValue.serverTimestamp() } },
    { merge: true },
  );
}
