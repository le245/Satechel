const mongoose= require('mongoose');
const { Schema}=mongoose


const offerSchema = new Schema ({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['product', 'category', 'referral'],
    required: true,
  },
  discount: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  discountedPrice:{
    type:Number,
    default:0
  },
 
 
  status: {
    type: Boolean,
    default: true,
  },
  originalPrice: {
    type: Number,
    default: null,
  },
});

const Offer = mongoose.model('Offer', offerSchema);
module.exports = Offer;