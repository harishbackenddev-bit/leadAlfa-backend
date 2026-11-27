const rateLimit = require('express-rate-limit');


const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,   
  legacyHeaders: false,   
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts, please try again after 15 minutes.'
  }
});

const resendCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many resend code requests. Please try again after 15 minutes.'
  }
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Upload limit reached. Please wait a minute before uploading more files.'
  }
});


const submissionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many submission requests. Please wait a few minutes before trying again.'
  }
});

const applicationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many campaign application requests. Please wait a moment before trying again.'
  }
});

const reminderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many reminder requests. Please wait before sending another.'
  }
});

const reviewLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many review actions. Please wait a few minutes before continuing.'
  }
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many password reset attempts. Please try again after 15 minutes.'
  }
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many contact requests submitted. Please try again after 15 minutes.'
  }
});

const bookCallLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many call requests submitted. Please try again after 15 minutes.'
  }
});

const userFeedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many feedback reports submitted. Please wait a few minutes before submitting again.'
  }
});

module.exports = {
  globalLimiter,
  authLimiter,
  resendCodeLimiter,
  uploadLimiter,
  submissionLimiter,
  applicationLimiter,
  reminderLimiter,
  reviewLimiter,
  passwordResetLimiter,
  contactLimiter,
  bookCallLimiter,
  userFeedbackLimiter,
};