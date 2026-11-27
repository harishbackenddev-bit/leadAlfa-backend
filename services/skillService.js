const Skill = require("../models/creatorProfile/skill.model");

const getAllSkills = async () => {
  return await Skill.findAll();
};

const getSkillById = async (id) => {
  return await Skill.findByPk(id);
};

const createSkill = async (skillData) => {
  return await Skill.create(skillData);
};

const updateSkill = async (id, skillData) => {
  const skill = await Skill.findByPk(id);
  if (!skill) return null;
  return await skill.update(skillData);
};

const deleteSkill = async (id) => {
  const skill = await Skill.findByPk(id);
  if (!skill) return null;
  await skill.destroy();
  return skill;
};

module.exports = {
  getAllSkills,
  getSkillById,
  createSkill,
  updateSkill,
  deleteSkill,
};
