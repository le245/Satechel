const Product = require("../../Models/productSchema");
const Category = require("../../Models/categorySchema");
const User = require("../../Models/userSchema");

const { handleupload, handleUpload } = require("../../config/cloudinary");

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    res.render("product-add", {
      cat: category,
    });
  } catch (error) {
    res.redirect("/pageerror");
  }
};

const addproducts = async (req, res) => {
  try {
    const {
      productName,
      description,
      category,
      productImages,
      quantity,
      regularPrice,
    } = req.body;

    if (
      !productName ||
      productName.trim() === "" ||
      !description ||
      description.trim() === "" ||
      !category ||
      category.trim() === "" ||
      !quantity ||
      quantity.trim() === "" ||
      !regularPrice ||
      regularPrice.trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        error: "All fields Product Name Description Category are required",
      });
    }

    if (!/^[a-zA-Z0-9\s]{3,100}$/.test(productName?.trim())) {
      return res.status(400).json({
        success: false,
        error:
          "Product name must be 3-100 characters long and contain only alphanumeric characters and spaces",
      });
    }

    if (description.trim().length < 10 || description.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        error: "Description must be between 10 and 1000 characters",
      });
    }

    const categoryId = await Category.findOne({ name: category });
    if (!categoryId) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid category name" });
    }

    if(!productImages?.length > 3){
      return res.status(400).json({
        success: false,
        error: "At least 3 product images are required",
      });
    }

    const imagePaths = [];

    for (const base64Image of productImages) {
      try {
        const result = await handleUpload(base64Image);
        imagePaths.push(result.secure_url);
      } catch (err) {
       
        return res.status(400).json({
          success: false,
          error: "Failed to upload one or more images to Cloudinary",
        });
      }
    }

    const productExists = await Product.findOne({
      productName: productName.trim(),
    });
    if (productExists) {
      return res.status(400).json({
        success: false,
        error: "Product already exists please try with another name",
      });
    }

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({
        success: false,
        error: "Quantity must be 0 or greater",
      });
    }

    const newProduct = new Product({
      productName: productName.trim(),
      description: description.trim(),
      category: categoryId._id,
      productImage: imagePaths,
      quantity,
      regularPrice,
    });

    await newProduct.save();

    return res.status(200).json({
      success: true,
      message: "Product added successfully",
      redirectUrl: "/admin/product",
    });
  } catch (error) {
   
    return res.status(500).json({
      success: false,
      error: error.message || "Server error while saving product",
    });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;

    const productData = await Product.find({
      $or: [{ productName: { $regex: new RegExp(".*" + search + ".*", "i") } }],
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate("category")
      .exec();

    const count = await Product.find({
      $or: [{ productName: { $regex: new RegExp(".*" + search + ".*", "i") } }],
    }).countDocuments();

    const category = await Category.find({ isListed: true });

    if (category) {
      res.render("product", {
        data: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
      });
    } else {
      res.render("pageNotFound");
    }
  } catch (error) {

    res.redirect("/pageNotFound");
  }
};

const blockProduct = async (req, res) => {
  try {
    const productId = req.query.id;
    await Product.updateOne({ _id: productId }, { isBlocked: true });
    return res
      .status(200)
      .json({ success: true, message: "blocked successfully" });
  } catch (error) {

    res.redirect("/admin/pageerror");
  }
};

const unblockProduct = async (req, res) => {
  try {
    const productId = req.query.id;
    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "product id not found" });
    }
    await Product.updateOne({ _id: productId }, { isBlocked: false });
    return res
      .status(200)
      .json({ success: true, message: "unblocked successfully" });
  } catch (error) {
  
    res.redirect("/admin/pageerror");
  }
};

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findOne({ _id: id });
    if (!product) {
      return res.status(400).json({success:false,error:"Product not found"});
    }
    const categories = await Category.find({});
    res.render("product-edit", {
      product: product,
      cat: categories,
    });
  } catch (error) {
  
    res.redirect("/admin/pageerror");
  }
};

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const {
      productName,
      description,
      category,
      quantity,
      regularPrice,
      productImages,
    } = req.body;

    if (
      !productName ||
      productName.trim() === "" ||
      !description ||
      description.trim() === "" ||
      !category ||
      category.trim() === "" ||
      !quantity ||
      quantity.toString().trim() === "" ||
      !regularPrice ||
      regularPrice.toString().trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        error: "All fields are required",
      });
    }

    if (!/^[a-zA-Z0-9\s]{3,100}$/.test(productName.trim())) {
      return res.status(400).json({
        success: false,
        error:
          "Product name must be 3-100 characters long and contain only alphanumeric characters and spaces",
      });
    }

    const existingProduct = await Product.findOne({
      productName: productName.trim(),
      _id: { $ne: id },
    });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        error: "Product name already exists",
      });
    }

    const categoryId = await Category.findById(category);
    if (!categoryId) {
      return res.status(400).json({ error: "Invalid category" });
    }

    if (description.trim().length < 10 || description.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        error: "Description must be between 10 and 1000 characters",
      });
    }

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({
        success: false,
        error: "Quantity must be 0 or greater",
      });
    }

    const parsedRegularPrice = parseFloat(regularPrice);
    if (isNaN(parsedRegularPrice) || parsedRegularPrice <= 0) {
      return res.status(400).json({
        success: false,
        error: "Regular price must be greater than 0",
      });
    }

    if (!productImages || !Array.isArray(productImages) || productImages.length < 3) {
      return res.status(400).json({
        success: false,
        error: "At least 3 product images are required",
      });
    }

    const imagePaths = [];
    for (const base64Image of productImages) {
      try {
        const result = await handleUpload(base64Image);
        imagePaths.push(result.secure_url);
      } catch (err) {
      
        return res.status(400).json({
          success: false,
          error: "Failed to upload one or more images to Cloudinary",
        });
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        productName: productName.trim(),
        description: description.trim(),
        category: categoryId._id,
        quantity: parsedQuantity,
        regularPrice: parsedRegularPrice,
        productImage: imagePaths,
      },
      { new: true }
    );

    if (updatedProduct) {
      return res.status(200).json({
        success: true,
        message: "Product updated successfully",
        redirectUrl: "/admin/products",
      });
    } else {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }
  } catch (error) {
  
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

module.exports = {
  getProductAddPage,
  addproducts,
  getAllProducts,
  blockProduct,
  unblockProduct,
  getEditProduct,
  editProduct,
};