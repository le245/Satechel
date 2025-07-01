const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  items: [{
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      required: false
    },
  
  }],
    subTotal: {
      type: Number,
      required: false
    },

});

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart;
