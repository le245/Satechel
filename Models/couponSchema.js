const mongoose = require('mongoose');
const Cart = require('./cartSchema');
const { Schema } = mongoose;

const couponSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    createdOn: {
      type: Date,
      default: Date.now,
      required: true,
    },
    expireOn: {
      type: Date,
      required: true,
    },
    offerPrice: {
      type: Number,
      required: true,
    },
    minimumPrice: {
      type: Number,
      required: true,
    },
    isList: {
      type: Boolean,
      required: true,
    },
   userId: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
      usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },

  { timestamps: true }
);

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;

