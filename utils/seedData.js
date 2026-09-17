const Category = require("../models/creatorProfile/category.model");
const Skill = require("../models/creatorProfile/skill.model");

const categoryData = require("../seedData/categories");
const skillData = require("../seedData/skills");

async function seedCategories()
{
    const count = await Category.count();
    if(count>0)
    {
        return;
    }

    await Category.bulkCreate(categoryData);
}

async function seedSkills()
{
    const count = await Skill.count();
    if(count>0)
    {
        return;
    }

    await Skill.bulkCreate(skillData);
}

async function runSeeds()
{
    await seedCategories();
    await seedSkills();
}

module.exports = { runSeeds };