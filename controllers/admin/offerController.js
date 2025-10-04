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

    const offers = await Offer.find(query)
    .populate('productId','productName')
    .populate('categoryId','name')
    .skip(skip)
    .limit(limit);

    

    res.render('offerList', {
      offers,
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


if (isNaN(discount) || discount < 1 || discount > 99) {
  return res.status(STATUS_CODES.BAD_REQUEST).json({ 
    success: false, 
    message: 'Discount must be a number between 1 and 99' 
  });
}


    const offerData = new Offer({
      name,
      type,
      discount,
      status: true,
    });

   
    if (type === 'product' && productId) {
      const product = await Product.findById(productId).populate('category');
      if (!product) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ 
          success: false, 
          message: 'Product not found' 
        });
      }

      const regularPrice = product.regularPrice;
      if (!regularPrice || isNaN(regularPrice) || regularPrice <= 0) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ 
          success: false, 
          message: 'Invalid regular price for the product' 
        });
      }

      const discountedPrice = regularPrice - (regularPrice * discount) / 100;

      offerData.productId = product._id;
      offerData.originalPrice = regularPrice;
      offerData.discountedPrice = Number(discountedPrice.toFixed(2));

      const newOffer = await offerData.save();

      product.productOffer = discount;
    
      const bestDiscount = Math.max(product.productOffer || 0, product.category?.categoryOffer || 0);
      product.discountedPrice = product.regularPrice - (product.regularPrice * bestDiscount) / 100;

      await product.save();

      return res.status(STATUS_CODES.CREATED).json({
        success: true,
        message: 'Product offer added successfully',
        offer: newOffer,
      });
    }

    if (type === 'category' && categoryId) {
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ 
          success: false, 
          message: 'Category not found' 
        });
      }

      offerData.categoryId = categoryId;
      offerData.originalPrice = null;
      offerData.discountedPrice = null;

      const newOffer = await offerData.save();

      category.categoryOffer = discount;
      await category.save();


      const products = await Product.find({ category: categoryId }).populate('category');
      for (let product of products) {
        const bestDiscount = Math.max(product.productOffer || 0, category.categoryOffer || 0);
        product.discountedPrice = product.regularPrice - (product.regularPrice * bestDiscount) / 100;
        await product.save();
      }

      return res.status(STATUS_CODES.CREATED).json({
        success: true,
        message: 'Category offer added successfully',
        offer: newOffer,
      });
    }

    return res.status(STATUS_CODES.BAD_REQUEST).json({ 
      success: false, 
      message: 'Invalid offer type or missing ID' 
    });

  } catch (error) {

    console.log("=============================",error)

    return res.status(STATUS_CODES.SERVER_ERROR).json({ 
      success: false, 
      message: 'Server Error' 
    });
  }
};





const updateOffer=async(req,res)=>{
  try {
    
    const offerId=req.params.offerId;
    const {discount}=req.body;

    if(!discount||discount<0||discount>99){
      return res.status(STATUS_CODES.NOT_FOUND).json({
        success:false,
        message:'Offer not found'
      })
    }
    const offer= await Offer.findById(offerId);
    if(!offer){
      return res.status(STATUS_CODES.NOT_FOUND).json({
        succes:false,
        message:'Offer not found'
      })
    }

    offer.discount=discount;

    if(offer.type === 'product'){
      const product=await Product.findById(offer.productId)
        if(!product){
          return res.status(STATUS_CODES.NOT_FOUND).json({
            success:false,
            message:"product not found"
          })
        }
    

    const regularPrice = product.regularPrice;
      if (!regularPrice || isNaN(regularPrice) || regularPrice <= 0) {
        return res
          .status(STATUS_CODES.BAD_REQUEST)
          .json({ 
            
            success: false, 
            message: 'Invalid regular price for the product' 
          });
      }
      const discountedPrice=regularPrice-(regularPrice*discount)/100;
      
      product.productOffer=discount;

      await product.save()

      offer.originalPrice=regularPrice;
      offer.discountedPrice=Number(discountedPrice.toFixed(2))


    }else if(offer.type === 'category'){

      const category=await Category.findById(offer.categoryId)
      if(!category){
        return res.status(STATUS_CODES.NOT_FOUND).json({
          success:false,
          message:"category not found"
        })
      }

      category.categoryOffer=discount;
      await category.save();
       
      const products= await Product.find({category:offer.categoryId})
      for(let product of products){
        const regularPrice=product.regularPrice;
        if (!regularPrice || isNaN(regularPrice) || regularPrice <= 0) continue;

        product.categoryOffer
        await product.save()
      }
      offer.originalPrice = undefined;
      offer.discountedPrice = undefined;

    }

    await  offer.save()
    
    return res.status(STATUS_CODES.OK).json({
      success:true,
      message:"Offer updated succesfully"
    })

    
  } catch (error) {
     console.error('Error updating offer:', error);
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
      const product = await Product.findById(offer.productId).populate('category');
      if (product) {
        product.productOffer = 0;

     
        const categoryOffer = product.category?.categoryOffer || 0;
        const bestDiscount = Math.max(0, categoryOffer);
        product.discountedPrice = bestDiscount > 0 ? product.regularPrice - (product.regularPrice * bestDiscount) / 100 : product.regularPrice;

        await product.save();
      }
    } else if (offer.type === 'category') {
      const category = await Category.findById(offer.categoryId);
      if (category) {
        category.categoryOffer = 0;
        await category.save();
      }

      const products = await Product.find({ category: offer.categoryId });
      for (let product of products) {
        product.categoryOffer = 0;

        
        const bestDiscount = Math.max(product.productOffer || 0, 0);
        product.discountedPrice = bestDiscount > 0 ? product.regularPrice - (product.regularPrice * bestDiscount) / 100 : product.regularPrice;

        await product.save();
      }
    }

    await Offer.findByIdAndDelete(offerId);

    return res.status(STATUS_CODES.OK).json({ success: true, message: 'Offer removed successfully' });

  } catch (error) {
    console.error("Error in removeOffer:", error);
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

