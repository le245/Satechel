const Product=require("../../Models/productSchema")
const Category=require("../../Models/categorySchema")
const User=require("../../Models/userSchema")
// const fs=require("fs")
// const path=require("path");
// const sharp=require("sharp")
const {handleupload, handleUpload}=require("../../config/cloudinary")


const getProductAddPage=async (req,res)=>{
    try {
        const category=await Category.find({isListed:true})
        res.render("product-add",{
            cat:category,
           
            
        })

    } catch (error) {
        console.log("Error in getProductaddpage:",error)
        res.redirect("/pageerror")
    }
}

// const addproducts=async(req,res)=>{
//     try{
// const products=req.body;
// const productExists=await Product.findOne({
//     productName:products.productName,
    
// });
// // if(!productExists){
// //     const images=[]

// //     if(req.files && req.files.length>0){
// //         for(let i=0;i<req.files.length;i++){
// //             const orginalImagePath=req.files[i].path;

// //             const resizedImagePath=path.join('public','uploads','product-images',req.files[i].filename)
// //             await sharp(orginalImagePath).resize({width:440,height:440}.toFile(resizedImagePath));
// //             image.push(req.files[i].filename);
// //         }
// //     }
// //     const categoryId=await Category.findOne({name:products.category});

// //     if(!categoryId){
// //         return res.status(400).join("Invalid category name")
// //     }
// //     const newProduct= new Product ({
// //         productName:products.description,
// //         description:products.description,
// //         category:categoryId._id,
// //         regularPrice:products.regularPrice,
// //         salePrice:Products.salePrice,
// //         CreatedOn:newDate(),
// //         quantity:products.quantity,
// //         size:Products.color,
// //         productImage:images,
// //         status:'Available',
// //     })
// //     await newProduct.save();
// //     return res.redirect("/admin/addproducts")
// // }else{
// //   return res.status(400).json("Product already exists,please try with another name")
// // }
// if (
//     !req.files ||
//     !req.files.productImages ||
//     req.files.productImages.length < 3
//   ) {
//     return res.status(400).json({
//       success: false,
//       error: 'At least 3 product images are required',
//     });
//   }

//   const imagePaths = [];
//   for (const file of req.files.productImages) {
//     const b64 = Buffer.from(file.buffer).toString('base64');
//     const dataURI = `data:${file.mimetype};base64,${b64}`;
//     const result = await handleUpload(dataURI);
//     imagePaths.push(result.secure_url);
//     console.log("Upload to Cloudinary:",result.secure_url);
//   }

//   if (imagePaths.length < 3) {
//     return res.status(400).json({
//       success: false,
//       error: 'Failed to upload at least 3 images to Cloudinary',
//     });
//   }
//     }catch(error){
//       console.error("Error saving product",error);
//       return res.redirect("/admin/pageerror")
//     }
// }

const addproducts = async (req, res) => {

  
    try {

        console.log(1);
      const { productName, description, category, variants,productImages } = req.body;
      console.log(req.body.productName || 0,"======================================")

  if (
    !productName || productName.trim() === '' ||
    !description || description.trim() === '' ||
    !category || category.trim() === '' ||
    !variants
  ) {
    return res.status(400).json({
      success: false,
      error: 'All fields (Product Name, Description, Category, Variants) are required',
    });
  }

  



      if (!/^[a-zA-Z0-9\s]{3,100}$/.test(productName?.trim())) {
        return res.status(400).json({
          success: false,
          error:
            'Product name must be 3-100 characters long and contain only alphanumeric characters and spaces',
        });
      }
  
      if (description.trim().length < 10 || description.trim().length > 1000) {
        return res.status(400).json({
          success: false,
          error: 'Description must be between 10 and 1000 characters',
        });
      }


  
      const categoryId = await Category.findOne({ name: category });
      if (!categoryId) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid category name' });
      }


      
  
  
      let parsedVariants;
      try {
        parsedVariants = JSON.parse(variants);
        if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
          throw new Error('Variants must be a non-empty array');
        }
      } catch (e) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid variants format' });
      }
  
      const variantsArray = parsedVariants.map((variant) => {
        const quantity = parseInt(variant.quantity);
        const regularPrice = parseFloat(variant.regularPrice);
        const salesPrice = variant.salesPrice
          ? parseFloat(variant.salesPrice)
          : null;
  
        if (!['15ml', '50ml', '100ml'].includes(variant.size)) {
          throw new Error('Invalid size: ${variant.size}');
        }
        if (isNaN(quantity) || quantity < 0) {
          throw new Error('Quantity must be a non-negative number');
        }
        if (isNaN(regularPrice) || regularPrice <= 0) {
          throw new Error('Regular price must be a positive number');
        }
        if (
          salesPrice !== null &&
          (isNaN(salesPrice) || salesPrice < 0 || salesPrice >= regularPrice)
        ) {
          throw new Error(
            'Sales price must be a positive number less than regular price'
          );
        }
  
        return {
          size: variant.size,
          quantity,
          regularPrice,
          salesPrice,
        };
      });


      const totalStock = variantsArray.reduce(
        (sum, variant) => sum + variant.quantity,
        0
      );
      if (totalStock === 0) {
        return res.status(400).json({
          success: false,
          error: 'Total stock across all variants must be greater than 0',
        });
      }
  
   
  


      if (!productImages || !Array.isArray(productImages) || productImages.length < 3) {
        return res.status(400).json({
          success: false,
          error: 'At least 3 product images are required',
        });
      }
      
      const imagePaths = [];
      for (const base64Image of productImages) {
        try {
          const result = await handleUpload(base64Image); // Assuming this handles base64 strings
          imagePaths.push(result.secure_url);
        } catch (err) {
          console.error('Error uploading image to Cloudinary:', err);
          return res.status(400).json({
            success: false,
            error: 'Failed to upload one or more images to Cloudinary',
          });
        }
      }
      
      if (imagePaths.length < 3) {
        return res.status(400).json({
          success: false,
          error: 'Failed to upload at least 3 images to Cloudinary',
        });
      }


      
      const productExists = await Product.findOne({
        productName: productName.trim(),
      });
      if (productExists) {
        return res.status(400).json({
          success: false,
          error: 'Product already exists, please try with another name',
        });
      }

  

  
      const newProduct = new Product({
        productName: productName.trim(),
        description: description.trim(),
        category: categoryId._id,
        productImage: imagePaths,
        variants: variantsArray,
        totalStock,
        status: totalStock > 0 ? 'Available' : 'Out of stock',
      });
  
      await newProduct.save();
      console.log('Product saved:', newProduct);
  
      return res.status(200).json({
        success: true,
        message: 'Product added successfully',
        redirectUrl: '/admin/product',
      });
    } catch (error) {
      console.error('Error saving product:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Server error while saving product',
      });
    }
  };

const getAllProducts=async(req,res)=>{
    try{
        const search=req.query.search ||"";
        const page=req.query.page||1;
        const limit=4;
        const productData=await Product.find({$or:[{productName:{$regex:new RegExp(".*"+search+".*")}},],
        }).limit(limit*1)
        .skip((page-1)*limit)
        .populate('category')
        .exec();
        

        const count=await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},

            ]
        }).countDocuments();

        const category= await Category.find({isListed:true});

        if(category){
            res.render("product",{
                data:productData,
                currentPage:page,
                totalPages:page,
                totalPages:Math.ceil(count/limit),
                cat:category,

            })
        }else{
            res.render("page-404")
        } 
    }catch (error){
        res.redirect("/pageerror")
    }
}

const blockProduct = async(req,res) =>{
  try {
  
    const productId = req.query.id;
  
    await Product.updateOne({ _id: productId }, { isBlocked: true });
    
    return res.status(200).json({success:true, message:"blocked successfully"})
} catch (error) {
    console.error("Error blocking product:", error);
    res.redirect("/admin/pageerror");
}
}

const unblockProduct = async (req, res) => {
    try {
        const productId = req.query.id;
        if(!productId){
          return res.status(400).json({success:false, message:"product id not found"})
        }
        await Product.updateOne({ _id: productId }, { isBlocked: false });
        return res.status(200).json({success:true, message:"unblocked successfully"})
    } catch (error) {
        console.error("Error unblocking product:", error);
        res.redirect("/admin/pageerror");
    }
};


module.exports={
    getProductAddPage,
    addproducts,
    getAllProducts,
    blockProduct,
    unblockProduct

}