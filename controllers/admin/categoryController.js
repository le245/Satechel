const Category = require("../../Models/categorySchema");
const Product= require("../../Models/productSchema")
const STATUS_CODES= require("../../Models/status")

const categoryInfo = async (req, res) => {
    try {
        let search = "";
        if (req.query.search) {
            search = req.query.search;
        }   

        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

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
       
        res.redirect("/admin/pageerror");
    }
};


const addCategory = async (req, res) => {
    const { name, description } = req.body;
  
       try {


      if (!name || !description) {
        return res
          .status(STATUS_CODES.BAD_REQUEST)
          .json({ error: 'Name and description are required' });
      }
  
        const nameRegex = /^[a-zA-Z0-9\s]+$/;
      if (!nameRegex.test(name)) {
             return res
          .status(STATUS_CODES.BAD_REQUEST)
          .json({
            error: 'Category name can only contain letters numbers and spaces',
          });
      }
  
             const existingCategory = await Category.findOne({
                 name: { $regex: `^${name}$`, $options: 'i' },
      });
      if (existingCategory) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ error: 'Category already exists' });
      }
  
      const newCategory = new Category({
        name: name.trim(),
        description: description.trim(),
                     });
      await newCategory.save();
  
      return res.status(STATUS_CODES.OK)
        .json({ success: true, message: 'Category added successfully' });
    } catch (error) {
      return res.status(STATUS_CODES.SERVER_ERROR).json({ error: 'Internal Server Error' });
    }
  };
  

const unlistCategory = async (req, res) => {
    try {
        const categoryId = req.query.id;
    
        
       
        await Category.updateOne(
            { _id: categoryId },
            { $set: { isListed: false } });

        await Product.updateMany(
            { categoryid: categoryId },
            { $set: { isListed: false } }
        );

        res.redirect("/admin/category");
    } catch (error) {
        console.error("Error unlisting category:", error);
        res.redirect("/admin/pageerror");
    }
};


const listCategory = async (req, res) => {
    try {
        const categoryId = req.query.id;

     
        await Category.updateOne(
            { _id: categoryId },
            { $set: { isListed: true } }
        );

   
        await Product.updateMany(
            { categoryid: categoryId },
            { $set: { isListed: true } }
        );

        res.redirect("/admin/category");
    } catch (error) {
        console.error("Error listing category:", error);
        res.redirect("/admin/pageerror");
    }
};


const getEditCategory = async (req, res) => {
    try{
        const categoryid = req.query.id;
        const category = await Category.findOne({ _id:categoryid });
        
        if (!category) {
            return res.redirect("/admin/category");
        }
        
        res.render("edit-category", { category: category });
    } catch (error) {
        res.redirect("/pageerror");
    }
};

const editCategory = async (req, res) => {
    try {
        const categoryid = req.params.id;
        const { categoryName, description } = req.body;

      
        if (!categoryName) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ error: 'Category name is required' });
        }
        if (categoryName.length < 2 || categoryName.length > 50) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ error: 'Category name must be between 2 and 50 characters' });
        }
        const nameRegex = /^[a-zA-Z0-9\s\-'&]+$/;
        if (!nameRegex.test(categoryName)) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ error: 'Category name can only contain letters, numbers, spaces, hyphens, and ampersands' });
        }
        if (!description) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ error: 'Description is required' });
        }
        if (description.length < 10 || description.length > 500) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ error: 'Description must be between 10 and 500 characters' });
        }
        const descriptionRegex = /^[a-zA-Z0-9\s.,!?'"\-()]+$/;
        if (!descriptionRegex.test(description)) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ error: 'Description contains invalid characters' });
        }

    

const existingCategory = await Category.findOne({
  name: { $regex: new RegExp(`^${categoryName}$`, "i") },
  _id: { $ne: categoryid }
});
if (existingCategory) {
  return res.status(STATUS_CODES.BAD_REQUEST).json({ error: 'A category with this name already exists' });
}

        const updateCategory = await Category.findByIdAndUpdate(
           categoryid ,
            {
                name: categoryName,
                description: description
            },
            { new: true }
        );

        if (!updateCategory) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ error: 'Category not found' });
        }

        return res.status(STATUS_CODES.OK).json({ message: 'Category updated successfully' });
    } catch (error) {
        return res.status(STATUS_CODES.SERVER_ERROR).json({ error: 'Internal server error' });
    }
};

module.exports = {
    categoryInfo,
    addCategory,
    unlistCategory,
    listCategory,
    getEditCategory,
    editCategory
};




