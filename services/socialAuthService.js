const User = require("../models/user.model");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/jwtUtil");
const { verifyAuth0Token } = require("../utils/auth0Util");
const AppError = require("../utils/appError");

const socialLoginUser = async (auth0Token, rememberMe) => {
  const decoded = await verifyAuth0Token(auth0Token);

  let userInfo;
  try {
    const response = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/userinfo`,
      {
        headers: { Authorization: `Bearer ${auth0Token}` },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new AppError(
        `Failed to fetch user info from Auth0: ${
          errorData.message || response.statusText
        }`,
        response.status
      );
    }

    userInfo = await response.json();
  } catch (error) {
    throw new AppError("Could not retrieve user details from Auth0.", 500);
  }

  const email = userInfo.email;
  if (!email) {
    throw new AppError("Email not provided by provider", 400);
  }

  // Check if user already exists
  let user = await User.findOne({ where: { email } });

  if (!user) {
    // create new user
    user = await User.create({
      firstName: userInfo.given_name || userInfo.name || "",
      lastName: userInfo.family_name || "",
      email,
      password: null,
      emailVerified: userInfo.email_verified || false,
    });
  } else {
    user.firstName = userInfo.given_name || userInfo.name || user.firstName;
    user.lastName = userInfo.family_name || user.lastName;
    await user.save();
  }

  // Issue tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user, rememberMe);

  return { user, accessToken, refreshToken };
};

module.exports = {
  socialLoginUser,
};
