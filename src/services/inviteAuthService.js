import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { firebaseConfig, getFirebaseInstance } from '../constants/firebaseConfig';
import {
  normalizeEmail,
  generateTemporaryInvitePassword,
  buildInviteContinueUrl,
} from '../utils/teamPermissions';

function getSafeOrigin(providedOrigin) {
  if (providedOrigin && typeof providedOrigin === 'string') {
    return providedOrigin.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return 'https://tarsashaz-cfe5d.web.app';
}

/**
 * Provisions a new colleague's Firebase Auth identity inside an isolated in-memory
 * secondary Firebase App (so the Organization Owner's active session is NEVER touched),
 * then immediately dispatches the official localized password-setup email whose continue
 * link redirects the colleague straight back to TarsasApp's Login page.
 */
export async function provisionAndSendColleagueInviteEmail({
  email,
  token = '',
  lang = 'hu',
  origin = '',
  skipFirebaseResetEmail = false,
}) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) {
    return { sent: false, errorCode: 'invalid-email', errorMessage: 'Invalid email address.' };
  }

  const { auth } = getFirebaseInstance();
  if (!auth) {
    return { sent: false, errorCode: 'auth-unavailable', errorMessage: 'Firebase Auth is unavailable.' };
  }

  let accountCreated = false;
  let alreadyExists = false;
  let provisionWarning = null;

  // 1. Provision Auth account in an isolated in-memory secondary Firebase App
  const tempAppName = `invite-provision-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let tempApp = null;
  try {
    tempApp = initializeApp(firebaseConfig, tempAppName);
    let tempAuth = null;
    try {
      tempAuth = initializeAuth(tempApp, { persistence: inMemoryPersistence });
    } catch {
      tempAuth = getAuth(tempApp);
    }

    const throwawayPassword = generateTemporaryInvitePassword(28);
    try {
      await createUserWithEmailAndPassword(tempAuth, cleanEmail, throwawayPassword);
      accountCreated = true;
      try {
        await signOut(tempAuth);
      } catch {
        // Ignore cleanup signOut errors on ephemeral app
      }
    } catch (createErr) {
      if (createErr?.code === 'auth/email-already-in-use') {
        alreadyExists = true;
      } else {
        provisionWarning = createErr?.code || createErr?.message || 'provision-error';
        console.warn('Invite Auth provision warning:', provisionWarning);
      }
    }
  } finally {
    if (tempApp) {
      try {
        await deleteApp(tempApp);
      } catch {
        // Ignore secondary app teardown errors
      }
    }
  }

  const continueUrl = buildInviteContinueUrl({
    origin: getSafeOrigin(origin),
    token,
    email: cleanEmail,
    passwordSet: true,
  });

  if (skipFirebaseResetEmail) {
    return {
      sent: true,
      accountCreated,
      alreadyExists,
      continueUrl,
      provisionWarning,
      emailSkipped: true,
    };
  }

  // 2. Dispatch official localized password-setup email via Firebase Auth

  try {
    auth.languageCode = lang === 'en' ? 'en' : 'hu';
  } catch {
    // Non-fatal if browser/SDK restricts languageCode mutation
  }

  try {
    try {
      await sendPasswordResetEmail(auth, cleanEmail, { url: continueUrl });
    } catch (settingsErr) {
      if (
        settingsErr?.code === 'auth/unauthorized-continue-uri' ||
        settingsErr?.code === 'auth/invalid-continue-uri' ||
        settingsErr?.code === 'auth/missing-continue-uri'
      ) {
        await sendPasswordResetEmail(auth, cleanEmail);
      } else {
        throw settingsErr;
      }
    }

    return {
      sent: true,
      accountCreated,
      alreadyExists,
      continueUrl,
      provisionWarning,
    };
  } catch (sendErr) {
    console.warn('sendPasswordResetEmail for colleague invite failed:', sendErr?.code || sendErr?.message);
    return {
      sent: false,
      accountCreated,
      alreadyExists,
      continueUrl,
      errorCode: sendErr?.code || 'send-failed',
      errorMessage: sendErr?.message || 'Failed to send password setup email.',
    };
  }
}

/**
 * Sends (or resends) a localized Firebase Auth password-setup email for an existing or
 * invited colleague email address, redirecting back to the TarsasApp Login view.
 */
export async function sendColleaguePasswordSetupEmail({
  email,
  token = '',
  lang = 'hu',
  origin = '',
}) {
  return provisionAndSendColleagueInviteEmail({ email, token, lang, origin });
}
