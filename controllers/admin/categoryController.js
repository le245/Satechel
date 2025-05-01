const Category = require("../../Models/categorySchema");

/**
 * Display categories with search and pagination
 */
const categoryInfo = async (req, res) => {
    try {
        // Initialize search parameter
        let search = "";
        if (req.query.search) {
            search = req.query.search;
        }

        // Pagination setup
        const page = parseInt(req.query.page) || 1;
        const limit = 5; // Items per page
        const skip = (page - 1) * limit;

        // Search query
        const query = {
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { description: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        };

        // Fetch categories with pagination and sorting (newest first)
        const categoryData = await Category.find(query)
            .sort({ createdAt: -1 })  // Sort by creation date descending (newest first)
            .skip(skip)
            .limit(limit);

        // Get total count for pagination
        const totalCategories = await Category.countDocuments(query);
        const totalPages = Math.ceil(totalCategories / limit);

        // Render category page with data
        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
            search
        });
    } catch (error) {
        console.error("Error in categoryInfo:", error);
        res.redirect("/admin/pageerror");
    }
};

/**
 * Add a new category
 */
const addCategory = async (req, res) => {
    const { name, description } = req.body;
    try {
        // Check if category already exists
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" });
        }

        // Create and save new category
        const newCategory = new Category({
            name,
            description,
            isListed: true // Default to listed
        });
        await newCategory.save();
        
        // Redirect back to category page
        res.redirect("/admin/category");
    } catch (error) {
        console.error("Error in addCategory:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Soft delete (unlist) a category
 */
const getListCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        res.redirect("/admin/category");
    } catch (error) {
        console.error("Error in getListCategory:", error);
        res.redirect("/admin/pageerror");
    }
};

/**
 * Re-list a category that was previously unlisted
 */
const getUnlistCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.redirect("/admin/category");
    } catch (error) {
        console.error("Error in getUnlistCategory:", error);
        res.redirect("/admin/pageerror");
    }
};

/**
 * Render the edit category page
 */
const getEditCategory = async (req, res) => {
    try {
        const id = req.query.id;
        const category = await Category.findOne({ _id: id });
        
        if (!category) {
            return res.redirect("/admin/category");
        }
        
        res.render("edit-category", { category: category });
    } catch (error) {
        console.error("Error in getEditCategory:", error);
        res.redirect("/pageerror");
    }
};

/**
 * Update a category
 */
const editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { categoryName, description } = req.body;
        
        // Check if another category already has this name
        const existingCategory = await Category.findOne({ 
            name: categoryName,
            _id: { $ne: id } // Exclude current category
        });

        if (existingCategory) {
            return res.status(400).json({ error: "Category name already exists" });
        }

        // Update the category
        const updateCategory = await Category.findByIdAndUpdate(id, {
            name: categoryName,
            description: description,
        }, { new: true });

        if (updateCategory) {
            res.redirect("/admin/category");
        } else {
            res.status(404).json({ error: "Category not found" });
        }
    } catch (error) {
        console.error("Error in editCategory:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory
};