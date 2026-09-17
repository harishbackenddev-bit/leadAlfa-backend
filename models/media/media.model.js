const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const Media = sequelize.define(
  "Media",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    url: { type: DataTypes.STRING, allowNull: true },
    type: {
      type: DataTypes.ENUM("image", "video", "document", "other"),
      allowNull: false,
    },
    provider: { type: DataTypes.STRING, allowNull: false },
    public_id: { type: DataTypes.STRING, allowNull: true },
    storageKey: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    s3Bucket: { type: DataTypes.STRING(128), allowNull: true, defaultValue: null },
    mimeType: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },
    fileSize: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
    uploadedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
    },
  },
  {
    timestamps: true,
    tableName: "Media",
    indexes: [
      { fields: ["type"] },
      { fields: ["uploadedBy"] },
      { fields: ["storageKey"] },
    ],
  }
);

Media.associate = (models) => {
  Media.hasMany(models.CreatorMedia, {
    foreignKey: "mediaId",
    as: "creatorLinks",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
};

module.exports = Media;
