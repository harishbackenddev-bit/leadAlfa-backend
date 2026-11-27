const { socialLoginUser } = require("../services/socialAuthService");
const AppError = require("../utils/appError");

const socialLogin = async (req, res) => {
  try {
    const { token, rememberMe } = req.body;

    if (!token) throw new AppError("Auth0 token is required", 400);

    const { user, accessToken, refreshToken } = await socialLoginUser(
      token,
      rememberMe
    );

    // Send refresh token as httpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000, // 30 days if rememberMe is true else 7 days
    });

    return res.status(200).json({
      message: "Social login successful",
      user: {
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        auth_token: accessToken,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Social Login Error : ", err);
    res.status(500).json({ error: "Something went wrong" });
  }
};

module.exports = { socialLogin };
