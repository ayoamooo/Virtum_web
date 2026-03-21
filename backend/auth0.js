const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');
const config = require('./config');

let jwksClientInstance = null;

function getJwksClient() {
  if (jwksClientInstance) return jwksClientInstance;
  if (!config.AUTH0_DOMAIN) return null;
  const issuerBase = `https://${config.AUTH0_DOMAIN}/`;
  jwksClientInstance = jwksRsa({
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 10 * 60 * 1000,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
    jwksUri: `${issuerBase}.well-known/jwks.json`
  });
  return jwksClientInstance;
}

function getSigningKey(header, callback) {
  const client = getJwksClient();
  if (!client) return callback(new Error('Auth0 is not configured'));
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

function verifyAuth0Token(token) {
  return new Promise((resolve, reject) => {
    const issuer = `https://${config.AUTH0_DOMAIN}/`;
    const aud = config.AUTH0_AUDIENCE || config.AUTH0_CLIENT_ID;
    jwt.verify(
      token,
      getSigningKey,
      {
        algorithms: ['RS256'],
        issuer,
        audience: aud
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded || {});
      }
    );
  });
}

module.exports = {
  verifyAuth0Token
};
