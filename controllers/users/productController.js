const Product = require("../../Models/productSchema");
const User = require("../../Models/userSchema");
const Offer = require("../../Models/offerSchema");
const Wishlist=require("../../Models/wishlistSchema")
const Category = require("../../Models/categorySchema");
const STATUS_CODES= require("../../Models/status")



const getProductDetailPage = async (req, res) => {
  try {
    const email = req.session.userEmail;
    if (!email) {
      return res.redirect('/home');
    }

    const userData = await User.findOne({ email, isBlocked: false }).lean();
    if (!userData) {
      return res.render("blocked", { message: "User is blocked by admin" });
    }

    const productId = req.params.id;
    const product = await Product.findById(productId).populate('category').lean();
    if (!product) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'Product not found' });
    }

    // Check if product is blocked OR category is unlisted
    const isUnavailable = product.isBlocked || !product.category.isListed;

    const productOffer = await Offer.findOne({
      productId: productId,
      type: 'product',
      status: true,
    }).lean();

    const categoryOffer = await Offer.findOne({
      categoryId: product.category._id,
      type: 'category',
      status: true,
    }).lean();

    const productDiscount = productOffer ? productOffer.discount : 0;
    const categoryDiscount = categoryOffer ? categoryOffer.discount : 0;
    const bestDiscount = Math.max(productDiscount, categoryDiscount);
  
    
    if (bestDiscount > 0 && product.regularPrice) {
      product.salesPrice = product.regularPrice * (1 - bestDiscount / 100);
    } else {
      product.salesPrice = product.regularPrice || 0;
    }

    const user = await User.findOne({ email, isBlocked: false }).lean();

    const wishlist = await Wishlist.findOne({ userId: user._id }).lean();
    const isInWishlist = wishlist ? wishlist.products.some(p => p.productId.toString() === productId) : false;

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
      isBlocked: false,
    })
      .populate('category')
      .lean()
      .then(products => products.filter(p => p.category.isListed));

    res.render('product-detail', {
      user,
      product,
      relatedProducts,
      isInWishlist,
      isUnavailable, // pass the flag to template
    });
  } catch (error) {
    console.error('Error in getProductDetailPage:', error);
    res.status(STATUS_CODES.SERVER_ERROR).json({ success: false, message: 'Something went wrong' });
  }
};
  


const addProductReview=async(req,res)=>{

  try {

  const productId=req.params.id
  const {rating,review}=req.body;
  const userId = req.session.user; 


    if (!userId) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, message: "Login required" });
    }
    if (!rating || !review) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Rating and review are required" });
    }
 

  const product = await Product.findById(productId)

  if(!product){
    return res.status(STATUS_CODES.NOT_FOUND).json({success:false ,message:"Product not found"})
  }

 

  const newReview={
    userId,
    rating:Number(rating),
    review,
    
  }

  product.reviews.push(newReview)

  await product.save();

  
 await product.populate('reviews.userId', 'name');


  res.json({success:true,message:"Review added successfully",reviews: product.reviews})
    
  } catch (error) {
    console.log('Error in getProductDetailPage:', error);
    res.status(STATUS_CODES.SERVER_ERROR).json({ success: false, message: 'Something went wrong' });
    
  }
}

const getProductReview=async(req,res)=>{


  try{
  
    const productId=req.params.id;
    const product= await Product.findById(productId).populate('reviews.userId', 'name')

     if (!product) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'Product not found' });
        }

         res.json({ success: true, reviews: product.reviews });

  }catch(error){
      console.log('Error in getProductDetailPage:', error);
    res.status(STATUS_CODES.SERVER_ERROR).json({ success: false, message: 'Something went wrong' });
  }
}


module.exports = {
  getProductDetailPage,
  addProductReview,
  getProductReview
};

