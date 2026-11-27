const categoryService = require("../services/categoryService");

const getAllCategories = async (req, res) => {
  try {
    const categories = await categoryService.getAllCategories();
    return res.status(200).json({ success: true, data: categories });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching categories:", error.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await categoryService.getCategoryById(id);
    if (!category)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching category:", error.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, description, iconUrl } = req.body;
    const category = await categoryService.createCategory({
      name,
      description,
      iconUrl,
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error creating category:", error.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await categoryService.updateCategory(id, req.body);
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error updating category:", error.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await categoryService.deleteCategory(id);
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    res
      .status(200)
      .json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error deleting category:", error.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
    getAllCategories,   
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
}
