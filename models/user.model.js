const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { validateGenericPhone } = require("../utils/phoneValidator");

const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lastName: {
    type: DataTypes.STRING,
    // allowNull defaults to true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isValidPhone(value) {
        if (value) {
          const result = validateGenericPhone(value);
          if (!result.isValid) {
            throw new Error("Invalid phone number format");
          }
        }
      },
    },
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM("brand", "creator", "admin"),
    allowNull: true,
    defaultValue: null,
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  verificationCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  verificationCodeExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  resetPasswordToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  resetPasswordExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  passwordChangedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

module.exports = User;
