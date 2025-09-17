const Product = require("../../Models/productSchema");
const Category = require("../../Models/categorySchema");
const User = require("../../Models/userSchema");
const Wishlist=require("../../Models/wishlistSchema")
const Cart=require("../../Models/cartSchema")
const STATUS_CODES= require("../../Models/status")



const loadWishlist=async(req,res)=>{

    try {
        const userId=req.session.user;
        const user =await User.findById(userId)

        if(!user){
            return res.redirect('/login')
        }


        const wishlist= await Wishlist.findOne({userId:userId}).populate('products.productId')

        const products=wishlist?wishlist.products:[]
    
        res.render('wishlist',{
            user,
            wishlist,
            products
        })
    } catch (error) {
         console.error('Error in getWishlist:', error);
    res.status(STATUS_CODES.SERVER_ERROR).send('There is an error');
    }
}


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