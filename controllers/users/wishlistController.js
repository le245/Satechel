const Product = require("../../Models/productSchema");
const Category = require("../../Models/categorySchema");
const User = require("../../Models/userSchema");
const Wishlist=require("../../Models/wishlistSchema")
const Offer=require("../../Models/offerSchema")
const Cart=require("../../Models/cartSchema")
const STATUS_CODES= require("../../Models/status")


const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);

    if (!user) {
      return res.redirect('/login');
    }
    

    const email = req.session.userEmail;
    const userData = await User.findOne({ email, isBlocked: false }).lean();
    if (!userData) {
     return res.render("blocked", { message: "User is blocked by admin" });
           
    }

    const wishlist = await Wishlist.findOne({ userId }).populate('products.productId');
    let products = wishlist ? wishlist.products : [];

    const offers = await Offer.find({ status: true }).lean();

    products = products.map((item) => {
      const product = item.productId;
      if (!product) return item;

      let finalPrice = product.regularPrice;

      const productOffer = offers.find(
        (offer) =>
          offer.type === 'product' &&
          offer.productId?.toString() === product._id.toString()
      );

      const categoryOffer = offers.find(
        (offer) =>
          offer.type === 'category' &&
          offer.categoryId?.toString() === product.category?._id.toString()
      );

      const productDiscount = productOffer ? productOffer.discount : 0;
      const categoryDiscount = categoryOffer ? categoryOffer.discount : 0;

      const bestDiscount = Math.max(productDiscount, categoryDiscount);

      let offerType = null;
      if (productOffer && productDiscount >= categoryDiscount) {
        offerType = 'product';
      } else if (categoryOffer && categoryDiscount > productDiscount) {
        offerType = 'category';
      }

      if (bestDiscount > 0) {
        finalPrice = product.regularPrice - (product.regularPrice * bestDiscount) / 100;
      }

      return {
        ...item.toObject(),
        productId: {
          ...product.toObject(),
          finalPrice: finalPrice.toFixed(2),
          discountPercent: bestDiscount,
          offerType, 
        },
      };
    });

    res.render('wishlist', {
      user,
      wishlist,
      products,
    });
  } catch (error) {
    console.error('Error in getWishlist:', error);
    res.status(STATUS_CODES.SERVER_ERROR).send('There is an error');
  }
};




const addWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    if (!userId) {
      return res
        .status(STATUS_CODES.UNAUTHORIZED)
        .json({ success: false, message: 'Please log in to add to wishlist' });
    }

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        userId,
        products: [{ productId }],
      });
    } else {
      const productExists = wishlist.products.some(
        (item) => item.productId.toString() === productId
      );

      if (productExists) {
        return res
          .status(STATUS_CODES.BAD_REQUEST)
          .json({ success: false, message: 'Product already in wishlist' });
      }

      wishlist.products.push({ productId });
    }

    await wishlist.save();

    res.json({ success: true, message: 'Product added to wishlist' });
  } catch (error) {
    console.error('Error in addToWishlist:', error);
    res.status(STATUS_CODES.SERVER_ERROR).json({ success: false, message: 'Server error' });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    if (!userId) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json({
        success: false,
        message: 'Please log in to remove from wishlist',
      });
    }

    if (!productId) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: 'Product ID is required',
      });
    }

    const updatedWishlist = await Wishlist.findOneAndUpdate(
      { userId: userId },
      { $pull: { products: { productId: productId } } },
      { new: true }
    );

    if (!updatedWishlist) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: 'Wishlist not found',
      });
    }

    res.status(STATUS_CODES.OK).json({
      success: true,
      message: 'Product removed from wishlist successfully',
      wishlist: updatedWishlist.products,
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(STATUS_CODES.SERVER_ERROR).json({
      success: false,
      message: 'Server error while removing from wishlist',
      error: error.message,
    });
  }
}

module.exports={
    loadWishlist,
    addWishlist,
    removeFromWishlist
}