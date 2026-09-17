const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const CreatorSkill = sequelize.define(
  "CreatorSkill",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    creatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "CreatorProfiles",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    skillId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Skills",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
  },
  {
    tableName: "CreatorSkills",
    timestamps: true,
    indexes: [
      { name: "idx_creatorSkill_creatorId", fields: ["creatorId"] },
      { name: "idx_creatorSkill_skillId", fields: ["skillId"] },
      {
        name: "idx_creatorSkill_unique_pair",
        unique: true,
        fields: ["creatorId", "skillId"],
      },
    ],
  }
);

CreatorSkill.associate = (models) => {
  CreatorSkill.belongsTo(models.CreatorProfile, {
    foreignKey: "creatorId",
    as: "creatorProfile",
  });
  CreatorSkill.belongsTo(models.Skill, {
    foreignKey: "skillId",
    as: "skill",
  });
};

module.exports = CreatorSkill;
