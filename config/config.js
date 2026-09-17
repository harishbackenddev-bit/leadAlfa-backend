require("dotenv").config();

const useSSL = process.env.DB_SSL === "true";

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
  },
  staging: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    dialectOptions: useSSL
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false, 
          },
        }
      : {},
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    dialectOptions: useSSL
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false, 
          },
        }
      : {},
  },
};
