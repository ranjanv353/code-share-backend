import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

function getClient() {
  const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
  const REGION = process.env.AWS_REGION;
  return jwksClient({
    jwksUri: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`
  });
}

function getKey(header, callback) {
  const client = getClient();
  client.getSigningKey(header.kid, function (err, key) {
    if (err) return callback(err);
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

export function optionalAuthenticateJWT(req, res, next) {
  const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
  const REGION = process.env.AWS_REGION;
  const CLIENT_ID = process.env.COGNITO_APP_CLIENT_ID;

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    req.user = null;
    console.log('[AUTH] No Authorization header: Guest');
    return next();
  }
  const token = authHeader.replace('Bearer ', '');
  jwt.verify(token, getKey, {
    audience: CLIENT_ID,
    issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
  }, (err, decoded) => {
    if (err) {
      req.user = null;
      console.log('[AUTH] JWT failed:', err.message);
    } else {
      req.user = decoded;
      console.log('[AUTH] Authenticated user:', decoded.sub);
    }
    next();
  });
}
