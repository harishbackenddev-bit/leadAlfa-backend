const {
  registerUser,
  setUserRole,
  loginUser,
  verifyEmailCode,
  resendVerificationCode,
  refreshAccessToken,
  requestPasswordReset,
  resetPassword,
  getUserRole,
  getUser,
} = require("../services/userService");

const { validationResult } = require("express-validator");

const {
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/jwtUtil");

const AppError = require("../utils/appError");

const register = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { firstName, lastName, phone, email, password } = req.body;
    const user = await registerUser({
      firstName,
      lastName,
      phone,
      email,
      password,
    });

    const token = generateAccessToken(user);

    const responseData = {
      message: "User registered successfully",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        auth_token: token,
      },
    };

    // For email feature toggled off include verification code in response
    if (process.env.TOGGLE_EMAIL === "false") {
      responseData.user.verificationCode = user.verificationCode;
      responseData.note =
        "If you didn't receive the email, use this code to verify your email for testing purposes.";
    }

    res.status(201).json(responseData);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Registration error:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const setRole = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { role } = req.body;
    const userId = req.user.id;

    const user = await setUserRole(userId, role);
    res.status(200).json({ message: "Role set successfully", role: user.role });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Set Role error:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const login = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password, rememberMe } = req.body;
    const user = await loginUser(email, password);

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user, rememberMe);

    // Sending refresh token in HttpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000, // 30 days if rememberMe is true else 7 days
    });

    return res.status(200).json({
      message: "Login successful",
      user: {
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        auth_token: token,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Login error : ", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};

const verifyEmail = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, code } = req.body;
    await verifyEmailCode(email, code);
    res.json({ message: "Email verified successfully!" });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Verify email error : ", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};

const resendCode = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email } = req.body;
    const responseData = await resendVerificationCode(email);
    return res.status(200).json(responseData);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Resend code error : ", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};

const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      throw new AppError("Refresh token missing", 401);
    }
    const user = await refreshAccessToken(token);
    const newAccessToken = generateAccessToken(user);
    return res.json({ accessToken: newAccessToken });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Refresh token error:", err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

const forgotPassword = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email } = req.body;
    const responseData = await requestPasswordReset(email);
    return res.status(200).json(responseData);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Forgot password error:", err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

const resetPasswordController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { token, newPassword } = req.body;
    await resetPassword(token, newPassword);

    // Clear the refresh token cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({ message: "Password has been reset successfully. Please log in again." });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Reset password error:", err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

const getUserController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.user.id;
    const user = await getUser(userId);
    const responseData = {
      message: "User fetched successfully",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    };
    res.status(200).json(responseData);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Get user error:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const getUserRoleController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.user.id;
    const userRole = await getUserRole(userId);
    res
      .status(200)
      .json({ message: "Role fetched successfully", role: userRole });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Get user role error:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const logout = async (req, res) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({ message: "Logout successful" });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Logout error:", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong during logout" });
  }
};

module.exports = {
  register,
  setRole,
  login,
  verifyEmail,
  resendCode,
  refreshToken,
  forgotPassword,
  resetPasswordController,
  getUserController,
  getUserRoleController,
  logout,
};
