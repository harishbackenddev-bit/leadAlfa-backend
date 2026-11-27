require("dotenv").config();

const useSSL = process.env.DB_SSL === "true";

const sslConfig = useSSL
  ? {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    }
  : {};

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: process.env.DB_DIALECT,
    logging: false,
    dialectOptions: sslConfig,   // 🔥 Add SSL to development
  },
  staging: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: process.env.DB_DIALECT,
    logging: false,
    dialectOptions: sslConfig,
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: process.env.DB_DIALECT,
    logging: false,
    dialectOptions: sslConfig,
  },
};