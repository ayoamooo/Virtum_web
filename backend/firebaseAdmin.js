const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  FIREBASE_ENABLED
} = require('./config');

let cachedAdmin = null;
let cachedAuth = null;

function getFirebaseAuth() {
  if (!FIREBASE_ENABLED) {
    throw new Error('Firebase is not configured on server');
  }
  if (cachedAuth) return cachedAuth;

  if (!cachedAdmin) {
    // Lazy require so backend can boot without firebase-admin installed/configured.
    // eslint-disable-next-line global-require
    cachedAdmin = require('firebase-admin');
  }

  if (!cachedAdmin.apps.length) {
    cachedAdmin.initializeApp({
      credential: cachedAdmin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY
      })
    });
  }

  cachedAuth = cachedAdmin.auth();
  return cachedAuth;
}

async function verifyFirebaseIdToken(idToken) {
  const auth = getFirebaseAuth();
  return auth.verifyIdToken(String(idToken || ''), true);
}

module.exports = {
  verifyFirebaseIdToken
};
