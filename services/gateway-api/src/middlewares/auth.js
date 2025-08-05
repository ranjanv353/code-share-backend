import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

/**
 * Get JWKS client for Cognito.
 */
function getClient() {
  const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
  const REGION = process.env.AWS_REGION;
  return jwksClient({
    jwksUri: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`
  });
}

/**
 * Retrieve signing key for JWT verification.
 */
function getKey(header, callback) {
  const client = getClient();
  client.getSigningKey(header.kid, function (err, key) {
    if (err) return callback(err);
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

/**
 * Middleware that authenticates JWT if present (optional).
 * Sets req.user, req.userEmail if verified.
 * Supports both guests and Cognito-authenticated users.
 */
export function optionalAuthenticateJWT(req, res, next) {
  const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
  const REGION = process.env.AWS_REGION;
  const CLIENT_ID = process.env.COGNITO_APP_CLIENT_ID;

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    req.user = null;
    req.userEmail = null;
    console.log('[AUTH] No Authorization header: Guest');
    return next();
  }

  const accessToken = authHeader.replace('Bearer ', '');

  // Optionally, allow frontend to pass ID token for email lookup
  const idToken = req.headers['x-id-token'] || null;

  jwt.verify(
    accessToken,
    getKey,
    {
      issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
      // Do not set 'audience' for access tokens!
    },
    (err, decoded) => {
      if (
        err ||
        !decoded ||
        decoded.token_use !== "access" ||
        decoded.client_id !== CLIENT_ID
      ) {
        req.user = null;
        req.userEmail = null;
        if (err) {
          console.log('[AUTH] JWT failed:', err.message);
        } else {
          console.log('[AUTH] JWT failed: invalid token use or client id');
        }
        return next();
      }
      // Attach user info
      req.user = decoded;
      req.userId = decoded.sub; // Convenience

      // Optionally decode idToken for email
      if (idToken) {
        try {
          const idDecoded = jwt.decode(idToken); // No verify, just decode for payload
          req.userEmail = idDecoded && idDecoded.email ? idDecoded.email : null;
        } catch {
          req.userEmail = null;
        }
      } else {
        req.userEmail = null;
      }

      console.log('[AUTH] Authenticated user:', decoded.sub, req.userEmail ? `(email: ${req.userEmail})` : '');
      next();
    }
  );
}
