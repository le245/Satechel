const Category = require("../../Models/categorySchema");

const categoryInfo = async (req, res) => {
    try {
        let search = "";
        if (req.query.search) {
            search = req.query.search;
        }

      
        const page = parseInt(req.query.page) || 1;
        const limit = 5; 
        const skip = (page - 1)*limit;

    
        const query = {
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { description: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        };

        const categoryData = await Category.find(query)
            .sort({ createdAt: -1 })  
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments(query);
        const totalPages = Math.ceil(totalCategories / limit);

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
 
const addCategory = async (req, res) => {
    const { name, description } = req.body;
  
    try {
      if (!name || !description) {
        return res
          .status(400)
          .json({ error: 'Name and description are required' });
      }
  
      const nameRegex = /^[a-zA-Z0-9\s]+$/;
      if (!nameRegex.test(name)) {
        return res
          .status(400)
          .json({
            error: 'Category name can only contain letters, numbers, and spaces',
          });
      }
  
      const existingCategory = await Category.findOne({
        name: { $regex: `^${name}$`, $options: 'i' },
      });
      if (existingCategory) {
        return res.status(400).json({ error: 'Category already exists' });
      }
  
      const newCategory = new Category({
        name: name.trim(),
        description: description.trim(),
      });
      await newCategory.save();
  
      return res
        .status(200)
        .json({ success: true, message: 'Category added successfully' });
    } catch (error) {
      console.error('Error adding category:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };
  

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


const getEditCategory = async (req, res) => {
    try{
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


const editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { categoryName, description } = req.body;
    
        const existingCategory = await Category.findOne({ 
            name: categoryName,
            _id: { $ne: id } 
        });

        if (existingCategory) {
            return res.status(400).json({ error: "Category name already exists" });
        }

      
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