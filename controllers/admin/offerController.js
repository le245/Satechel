const Category=require('../../Models/categorySchema.js')
const Offer= require('../../Models/offerSchema.js');
const Product= require('../../Models/productSchema.js')
const STATUS_CODES= require("../../Models/status")

const loadOffer= async(req,res)=>{
      try {
        if(!req.session.admin){
            return res.redirect('/admin/login')
        }

        const products= await Product.find({isBlocked:false});
        const  categories = await Category.find({isListed:true})


        
        return res.render('offer',{

            products,
            categories

        })

        
      } catch (error) {

     res.status(STATUS_CODES.SERVER_ERROR).json({
      success: false,
      message: 'Server Error',
    });
        
      }
}
const offerList = async (req, res) => {
  try {
    
    if (!req.session.admin) {
      return res.redirect('/admin/login');
    }

    
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const search = req.query.search || '';

    let query = { status: true };
    if (search) {
      query = {
        status: true,
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { type: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const totalOffers = await Offer.countDocuments(query);
    const totalPages = Math.ceil(totalOffers / limit);

    const offers = await Offer.find(query).skip(skip).limit(limit);

    let productName = null;
    if (offers.length > 0 && offers[0].productId) {
      const product = await Product.findById(offers[0].productId);
      productName = product?.productName || null;
    }

    res.render('offerList', {
      offers,
      productName,
      currentPage: page,
      totalPages,
      totalOffers,
      searchQuery: search
    });

  } catch (error) {
 
    res.status(STATUS_CODES.SERVER_ERROR).json({ success: false, message: 'Server error' });
  }
};

const addoffer = async (req, res) => {
  try {
    const { name, type, discount, productId, categoryId } = req.body;

    
    if (!discount || discount <= 0 || discount > 90) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Discount must be a number between 1 and 90' });
    }

    const  offerData = new Offer({
      name,
      type,
      discount,
      status: true,
    });

    if (type === 'product' && productId) {
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(STATUS_NOT_FOUND).json({ success: false, message: 'Product not found' });
      }

     
      const regularPrice = product.regularPrice;
      if (!regularPrice || isNaN(regularPrice) || regularPrice <= 0) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Invalid regular price for the product' });
      }

      const discountedPrice = regularPrice - (regularPrice * discount) / 100;

      offerData.productId = product._id;
      offerData.originalPrice = regularPrice;
      offerData.discountedPrice = Number(discountedPrice.toFixed(2));

      const newOffer = await offerData.save();


      product.productOffer = discount; 
      await product.save();

      return res.status(201).json({
        success: true,
        message: 'Product offer added successfully',
        offer: newOffer,
      });
    }

    if (type === 'category' && categoryId) {
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(STATUS_NOT_FOUND).json({ success: false, message: 'Category not found' });
      }

      offerData.categoryId = categoryId;
      const newOffer = await offerData.save();

      const products = await Product.find({ category: categoryId });

      for (let product of products) {
        const regularPrice = product.regularPrice;
        if (!regularPrice || isNaN(regularPrice) || regularPrice <= 0) {
         
          continue; 
        }

        const discountedPrice = regularPrice - (regularPrice * discount) / 100;
        
        product.categoryOffer = discount;
        await product.save();
      }

      return res.status(201).json({
        success: true,
        message: 'Category offer added successfully',
        offer: newOffer,
      });
    }

    return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Invalid offer type or missing ID' });
  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR).json({ success: false, message: 'Server Error' });
  }
};



const updateOffer = async (req, res) => {
  try {
    const offerId = req.params.offerId;
    const { discount, startDate, endDate } = req.body;

  
    if (!discount || discount <= 0 || discount > 100) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: 'Discount must be between 1% and 100%',
      });
    }

    const offer = await Offer.findById(offerId);
    if (!offer) {
      return res.status(STATUS_NOT_FOUND).json({
        success: false,
        message: 'Offer not found',
      });
    }

    offer.discount = discount;
    offer.startDate = startDate;
    offer.endDate = endDate;

    if (offer.type === 'product') {
      const product = await Product.findById(offer.productId);
      if (!product) {
        return res.status( STATUS_NOT_FOUND).json({ success: false, message: 'Product not found' });
      }

     
      const regularPrice = product.regularPrice;
      if (!regularPrice || isNaN(regularPrice) || regularPrice <= 0) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Invalid regular price for the product' });
      }

      const newPrice = regularPrice - (regularPrice * discount) / 100;
      product.productOffer = discount;
      await product.save();
    } else if (offer.type === 'category') {
      const category = await Category.findById(offer.categoryId);
      if (!category) {
        return res.status(STATUS_NOT_FOUND).json({ success: false, message: 'Category not found' });
      }

      const products = await Product.find({ category: offer.categoryId });

      for (let product of products) {
        const regularPrice = product.regularPrice;
        if (!regularPrice || isNaN(regularPrice) || regularPrice <= 0) {
          
          continue;
        }

        product.categoryOffer = discount;
        const bestDiscount = Math.max(product.productOffer || 0, discount);
        const newPrice = regularPrice - (regularPrice * bestDiscount) / 100;
        await product.save();
      }
    }

    await offer.save();

    return res.status(STATUS_CODES.OK).json({
      success: true,
      message: `offer updated successfully`,
      offer,
    });
  } catch (error) {
  
    return res.status(STATUS_CODES.SERVER_ERROR).json({
      success: false,
      message: 'Server Error',
    });
  }
};

const removeOffer = async (req, res) => {
  try {
    const offerId = req.params.offerId;
    const offer = await Offer.findById(offerId);
    if (!offer) {
      return res.status(STATUS_NOT_FOUND).json({ success: false, message: 'Offer not found' });
    }

    if (offer.type === 'product') {
      const product = await Product.findById(offer.productId);
      if (product) {
        product.productOffer = 0;
        await product.save();
      }
    } else if (offer.type === 'category') {
      const category = await Category.findById(offer.categoryId);
      if (category) {
        category.offers = (category.offers || []).filter(id => id.toString() !== offerId);
        await category.save();
      }

      const products = await Product.find({ category: offer.categoryId });
      for (let product of products) {
        product.categoryOffer = 0;
        await product.save();
      }
    }

    await Offer.findByIdAndDelete(offerId);

    return res.status(STATUS_CODES.NOT_FOUND).json({ success: true, message: 'Offer removed successfully' });

  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR).json({ success: false, message: 'Server error while removing offer' });
  }
};




module.exports={
    loadOffer,
    offerList,
    addoffer,
    updateOffer,
    removeOffer
}

