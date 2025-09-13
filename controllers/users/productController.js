const Product = require("../../Models/productSchema");
const User = require("../../Models/userSchema");
const Offer = require("../../Models/offerSchema");
const Category = require("../../Models/categorySchema");
const STATUS_CODES= require("../../Models/status")



const getProductDetailPage = async (req, res) => {
  try {
    const email = req.session.userEmail;
    if (!email) {
      return res.redirect('/home');
    }
    const productId = req.params.id;
    const product = await Product.findById(productId).populate('category').lean();
    if (!product) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'Product not found' });
    }

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
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
      isBlocked: false,
    }).limit(4).lean();

    res.render('product-detail', {
      user,
      product,
      relatedProducts,
    });
  } catch (error) {
    console.error('Error in getProductDetailPage:', error);
    res.status(STATUS_CODES.SERVER_ERROR).json({ success: false, message: 'Something went wrong' });
  }
};
module.exports = {
  getProductDetailPage,
};

