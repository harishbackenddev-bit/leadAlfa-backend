const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const AppError = require("./appError");

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) {
      return callback(err);
    }

    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

const verifyAuth0Token = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: process.env.AUTH0_AUDIENCE,
        issuer: `https://${process.env.AUTH0_DOMAIN}/`,
        algorithms: ["RS256"],
      },
      (err, decoded) => {
        if (err) return reject(new AppError("Invalid Auth0 token", 401));
        resolve(decoded);
      }
    );
  });
};

module.exports={verifyAuth0Token};
