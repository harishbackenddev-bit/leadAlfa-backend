const skillService = require("../services/skillService");

const getAllSkills = async (req, res) => {
  try {
    const skills = await skillService.getAllSkills();
    res.status(200).json({ success: true, data: skills });
  } catch (error) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching skills:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getSkillById = async (req, res) => {
  try {
    const { id } = req.params;
    const skill = await skillService.getSkillById(id);
    if (!skill)
      return res
        .status(404)
        .json({ success: false, message: "Skill not found" });
    res.status(200).json({ success: true, data: skill });
  } catch (error) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching skill:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const createSkill = async (req, res) => {
  try {
    const { name, description, iconUrl } = req.body;
    const skill = await skillService.createSkill({
      name,
      description,
      iconUrl,
    });
    res.status(201).json({ success: true, data: skill });
  } catch (error) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error creating skill:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const updateSkill = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await skillService.updateSkill(id, req.body);
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Skill not found" });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error updating skill:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const deleteSkill = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await skillService.deleteSkill(id);
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Skill not found" });
    res
      .status(200)
      .json({ success: true, message: "Skill deleted successfully" });
  } catch (error) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error deleting skill:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
    createSkill,
    getAllSkills,
    getSkillById,
    updateSkill,
    deleteSkill,
}
