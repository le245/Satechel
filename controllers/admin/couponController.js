const Product = require("../../Models/productSchema");
const Category = require("../../Models/categorySchema");
const User = require("../../Models/userSchema");
const Order=require("../../Models/orderSchema")
const Coupon = require('../../Models/couponSchema')
const mongoose = require('mongoose');
const STATUS_CODES= require("../../Models/status")



const loadCoupon=async(req,res)=>{
    try {
        
        if(!req.session.admin){
            return res.redirect('/admin/login')
        }

         const page=parseInt(req.query.page)||1;
         const limit =5;
         const skip=(page-1)*limit;



         const  coupons=  await Coupon.find({isList:true})
          .sort({ createdAt:-1})
          .skip(skip)
          .limit(limit)
          .exec()

          

          
           const count= await Coupon.countDocuments({isList:true})

           

            return res.render('coupon',{
            coupons,
            totalPages:Math.ceil(count/limit),
            currentPage:page,

           })
    } catch (error) {

    return res.status(STATUS_CODES.SERVER_ERROR).json({
      success: false,
      message: 'Can’t access coupon page',
      error: error.message,
    });

    }
}

const createCoupon = async (req, res) => {
  try {
    const { name, offerPrice, minimumPrice, expireOn, isList } = req.body;


    if (!name || !offerPrice || !minimumPrice || !expireOn) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: false,
        message: 'All fields name, offerPrice, minimumPrice, expireOn are required',
      });
    }

    const couponExists = await Coupon.findOne({ name });
    if (couponExists) {
      return res.status(409).json({
        status: false,
        message: 'A coupon with this name already exists',
      });
    }

    if (name.length < 3 || name.length > 50 || !/^[a-zA-Z0-9]+$/.test(name)) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: false,
        message: 'Coupon name must be alphanumeric and between 3 and 50 characters',
      });
    }


    const expirationDate = new Date(expireOn);
    if (isNaN(expirationDate) || expirationDate <= new Date()) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: false,
        message: 'Expiration date must be a valid date in the future',
      });
    }

    
    const parsedOfferPrice = parseFloat(offerPrice);
    if (isNaN(parsedOfferPrice) || parsedOfferPrice <= 0 || parsedOfferPrice > 10000) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: false,
        message: 'Offer price must be a number between ₹1 and ₹10,000',
      });
    }

    
    const parsedMinimumPrice = parseFloat(minimumPrice);
    if (isNaN(parsedMinimumPrice) || parsedMinimumPrice <= 0 || parsedMinimumPrice > 100000) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: false,
        message: 'Minimum purchase amount must be a number between ₹1 and ₹100,000',
      });
    }


    if (parsedOfferPrice >= parsedMinimumPrice) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: false,
        message: 'Offer price must be less than the minimum purchase amount',
      });
    }

   
    const newCoupon = new Coupon({
      name: name.toUpperCase(), 
      expireOn: expirationDate,
      offerPrice: parsedOfferPrice,
      minimumPrice: parsedMinimumPrice,

    isList : true
    });

    await newCoupon.save();

    return res.status(STATUS_CODES.CREATED).json({
      status: true,
      message: 'Coupon created successfully',
      coupon: newCoupon,
    });
  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR).json({
      status: false,
      message: 'An error occurred while creating the coupon',
      error: error.message,
    });
  }
};



const editCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const { expireOn, offerPrice, minimumPrice } = req.body;

    if (!expireOn || !offerPrice || !minimumPrice) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: false,
        message: 'Missing required fields',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: false,
        message: 'Invalid coupon ID',
      });
    }

    const parsedOfferPrice = parseFloat(offerPrice);
    if (isNaN(parsedOfferPrice) || parsedOfferPrice <= 0 || parsedOfferPrice > 10000) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: false,
        message: 'Offer price must be a number between ₹1 and ₹10,000',
      });
    }

    const parsedMinimumPrice = parseFloat(minimumPrice);
    if (isNaN(parsedMinimumPrice) || parsedMinimumPrice <= 0 || parsedMinimumPrice > 100000) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: false,
        message: 'Minimum purchase amount must be a number between ₹1 and ₹100,000',
      });
    }

    if (parsedOfferPrice >= parsedMinimumPrice) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: false,
        message: 'Offer price must be less than the minimum purchase amount',
      });
    }

    const expirationDate = new Date(expireOn);
    if (isNaN(expirationDate.getTime()) || expirationDate <= new Date()) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: false,
        message: 'Invalid expiration date. Please provide a valid future date.',
      });
    }

    const couponUpdate = await Coupon.findByIdAndUpdate(
      couponId,
      {
        offerPrice: parsedOfferPrice,
        minimumPrice: parsedMinimumPrice,
        expireOn: expirationDate,
      },
      { new: true }
    );

    if (!couponUpdate) {
      return res.status(STATUS_CODES.NOT_FOUND).json({
        status: false,
        message: 'Coupon not found. Please check the coupon details and try again.',
      });
    }

    return res.status(STATUS_CODES.OK).json({
      status: true,
      message: 'Coupon is updated',
      coupon: couponUpdate,
    });

  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR).json({
      status: false,
      message: 'There is an error in updating Coupon',
      error: error.message,
    });
  }
};


const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findByIdAndDelete(couponId);
    if (!coupon) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        status: false,
        message: 'Coupon does not Found',
      });
    }

    res.status(STATUS_CODES.OK).json({
      status: true,
      message: 'Coupon deleted Successfully',
    });
  } catch (error) {;
    
    res.status(STATUS_NOT_FOUND).json({
      status: false,
      message: 'Error in Deleting the Coupon',
    });
  }
};


module.exports={
    loadCoupon,
    createCoupon,
    editCoupon,
    deleteCoupon

}

