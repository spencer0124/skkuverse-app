/**
 * Google sign-in failure classification — no native imports, so the node test
 * runner can load it. `google-auth.ts` feeds it the native `statusCodes`.
 *
 * Two code systems arrive at the same catch:
 *  - @react-native-google-signin: strings. Its own constants (cancelled, in
 *    progress, Play services) come from the native module; everything else is
 *    the platform's raw code — Android `ApiException.statusCode` ("7" is
 *    CommonStatusCodes.NETWORK_ERROR), iOS `NSError.code`. On iOS a network
 *    failure rarely arrives as such: AppAuth's network error is -5, the same
 *    number as a cancel, and the library reports it as one; the NSURLError
 *    codes below only come from the profile fetch.
 *  - An Android Firebase failure that is not a FirebaseNetworkException (e.g.
 *    "internal error … Unable to resolve host") arrives as `auth/unknown`, so
 *    some offline sign-ins still read as UNKNOWN.
 *  - @react-native-firebase/auth: "auth/<kebab-case>".
 *
 * `report` decides Crashlytics. A dismissed sheet, a double tap and a dead
 * network are the student's situation, not a defect; recording them buried the
 * rows that are (DEVELOPER_ERROR, a disabled provider).
 */

export type GoogleSignInErrorCode =
  | 'DOMAIN_NOT_ALLOWED'
  | 'CANCELLED'
  | 'IN_PROGRESS'
  | 'PLAY_SERVICES_UNAVAILABLE'
  | 'NETWORK'
  | 'TOO_MANY_REQUESTS'
  | 'ACCOUNT_UNAVAILABLE'
  | 'UNKNOWN';

export class GoogleAuthError extends Error {
  // A declared field, not `constructor(public code)`: the node test runner's
  // type stripping rejects parameter properties.
  code: GoogleSignInErrorCode;

  constructor(code: GoogleSignInErrorCode) {
    super(code);
    this.code = code;
    this.name = 'GoogleAuthError';
  }
}

// Android GoogleSignInStatusCodes.SIGN_IN_CURRENTLY_IN_PROGRESS, which the
// library passes through raw rather than as its IN_PROGRESS constant.
const GOOGLE_IN_PROGRESS_CODES = new Set(['12502']);

export type NativeStatusCodes = {
  SIGN_IN_CANCELLED: string;
  IN_PROGRESS: string;
  PLAY_SERVICES_NOT_AVAILABLE: string;
};

const GOOGLE_NETWORK_CODES = new Set([
  '7', // Android CommonStatusCodes.NETWORK_ERROR
  '-1001', // iOS NSURLErrorTimedOut
  '-1003', // NSURLErrorCannotFindHost
  '-1004', // NSURLErrorCannotConnectToHost
  '-1005', // NSURLErrorNetworkConnectionLost
  '-1009', // NSURLErrorNotConnectedToInternet
  '-1020', // NSURLErrorDataNotAllowed
]);

const FIREBASE_CODES: Record<string, { code: GoogleSignInErrorCode; report: boolean }> = {
  'auth/network-request-failed': { code: 'NETWORK', report: false },
  // Counted on purpose: this is the row that says a quota is biting.
  'auth/too-many-requests': { code: 'TOO_MANY_REQUESTS', report: true },
  'auth/quota-exceeded': { code: 'TOO_MANY_REQUESTS', report: true },
  'auth/user-disabled': { code: 'ACCOUNT_UNAVAILABLE', report: true },
  'auth/account-exists-with-different-credential': { code: 'ACCOUNT_UNAVAILABLE', report: true },
};

function codeOf(err: unknown): string | null {
  if (typeof err !== 'object' || err === null || !('code' in err)) return null;
  const code = (err as { code: unknown }).code;
  return code == null ? null : String(code);
}

export function classifySignInError(
  err: unknown,
  statusCodes: NativeStatusCodes,
): { code: GoogleSignInErrorCode; report: boolean } {
  if (err instanceof GoogleAuthError) return { code: err.code, report: err.code === 'UNKNOWN' };
  const code = codeOf(err);
  if (code === null) return { code: 'UNKNOWN', report: true };
  if (code === statusCodes.SIGN_IN_CANCELLED) return { code: 'CANCELLED', report: false };
  if (code === statusCodes.IN_PROGRESS || GOOGLE_IN_PROGRESS_CODES.has(code)) {
    return { code: 'IN_PROGRESS', report: false };
  }
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return { code: 'PLAY_SERVICES_UNAVAILABLE', report: false };
  }
  if (GOOGLE_NETWORK_CODES.has(code)) return { code: 'NETWORK', report: false };
  return FIREBASE_CODES[code] ?? { code: 'UNKNOWN', report: true };
}

const SIGN_IN_INSTEAD_OF_LINK = new Set([
  // The Google identity already has an account: a returning student whose
  // reinstall or sign-out left a fresh anonymous user. Signing into their
  // account is the intended outcome.
  'auth/credential-already-in-use',
  'auth/email-already-in-use',
  // The anonymous user itself is gone or unusable on the server. It has
  // nothing worth keeping, so a plain sign-in loses nothing — and refusing
  // would leave the dead user in place and fail every retry.
  'auth/user-not-found',
  'auth/user-disabled',
  'auth/user-token-expired',
  'auth/invalid-user-token',
]);

/**
 * Whether a failed anonymous → Google link should become a plain sign-in.
 *
 * Only for the codes above. Any other failure — a dropped connection above
 * all — must not fall through: a sign-in that then succeeds for a Google
 * identity with no account yet mints a new uid and abandons a live anonymous
 * one for nothing.
 */
export function shouldSignInInsteadOfLink(err: unknown): boolean {
  const code = codeOf(err);
  return code !== null && SIGN_IN_INSTEAD_OF_LINK.has(code);
}

/** The auth.* message for a failure, or null when the screen should say nothing. */
export function signInErrorMessageKey(
  code: GoogleSignInErrorCode,
):
  | 'auth.domainNotAllowed'
  | 'auth.playServicesError'
  | 'auth.networkError'
  | 'auth.tooManyRequests'
  | 'auth.accountUnavailable'
  | 'auth.unknownError'
  | null {
  switch (code) {
    case 'CANCELLED':
    case 'IN_PROGRESS':
      return null;
    case 'DOMAIN_NOT_ALLOWED':
      return 'auth.domainNotAllowed';
    case 'PLAY_SERVICES_UNAVAILABLE':
      return 'auth.playServicesError';
    case 'NETWORK':
      return 'auth.networkError';
    case 'TOO_MANY_REQUESTS':
      return 'auth.tooManyRequests';
    case 'ACCOUNT_UNAVAILABLE':
      return 'auth.accountUnavailable';
    case 'UNKNOWN':
      return 'auth.unknownError';
  }
}

/** Whatever a caller caught from the sign-in flow, as a code. */
export function signInErrorCode(err: unknown): GoogleSignInErrorCode {
  return err instanceof GoogleAuthError ? err.code : 'UNKNOWN';
}
