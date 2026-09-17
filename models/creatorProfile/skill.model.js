const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const Skill = sequelize.define(
  "Skill",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    iconUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "URL or path to the skill icon",
    },
  },
  {
    tableName: "Skills",
    timestamps: true,
    indexes: [{ name: "idx_skill_name", fields: ["name"], unique: true }],
  }
);

Skill.associate = (models) => {
  Skill.belongsToMany(models.CreatorProfile, {
    through: "CreatorSkills",
    foreignKey: "skillId",
    otherKey: "creatorId",
    as: "creators",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
};

module.exports = Skill;
