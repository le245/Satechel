const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema(
  {
    productName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Category',
    },
    productImage: {
      type: [String],
      required: false,
      default: [],
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['Available', 'Out of stock', 'Discontinued'],
      required: true,
      default: 'Available',
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    regularPrice: {
      type: Number,
      required: true,
      min: 0.01, 
    },
salesPrice: {    
      type: Number,

      min: 0.01,
      validate: {
        validator: function (value) {
          return value <= this.regularPrice; 
        },
        message: 'Sales price cannot be greater than regular price',
      },
    },
    productOffer: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    categoryOffer: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviews: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        email: {
          type: String,
          required: true,
        },
        rating: {
          type: Number,
          required: true,
          min: 1,
          max: 5,
        },
        review: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  
  { timestamps: true }
);

const Product = mongoose.model('Product', productSchema);
module.exports = Product;