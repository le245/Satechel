const Cart = require("../../Models/cartSchema");
const Product = require("../../Models/productSchema");
const User = require("../../Models/userSchema");
const Address = require("../../Models/addressSchema");
const Order = require("../../Models/orderSchema");
const Coupon = require("../../Models/couponSchema");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const env = require("dotenv").config();
const mongoose = require("mongoose");
const easyinvoice = require("easyinvoice");
const moment = require("moment");
const STATUS_CODES= require("../../Models/status")



const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getCheckOut = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    const user = await User.findById(userId);
    const addressData = await Address.findOne({ userId });
    const addresses = addressData?.address || [];

    const coupons = await Coupon.find({
      isList: true,
      expireOn: { $gt: new Date() },
      userId: { $ne: userId },
    });

    res.render("checkout", {
      cart,
      user,
      userAddress: addresses,
      Coupon: coupons,
    });
  } catch (error) {
   
    res
      .status(STATUS_SERVER_ERROR)
      .render("pageNotFound", {
        message: "Server error, please try again later",
      });
  }
};

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId, subTotal, orderTotal, paymentMethod, couponCode } = req.body;

    if (!addressId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Address and payment method are required",
      });
    }

    const userAddress = await Address.findOne({ userId });
    if (!userAddress) {
      return res.status(400).json({ success: false, message: "User address not found" });
    }

    const selectedAddress = userAddress.address.find(
      (addr) => addr._id.toString() === addressId
    );
    if (!selectedAddress) {
      return res.status(400).json({ success: false, message: "Selected address not found" });
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    for (const item of cart.items) {
      if (!item.productId) {
        return res.status(400).json({
          success: false,
          message: `Product not found for item: ${item.productName || "Unknown"}`,
        });
      }
      if (item.productId.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock for ${item.productId.productName}`,
        });
      }
    }

    let discount = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({
        name: couponCode,
        isList: true,
        expireOn: { $gt: new Date() },
      });

      if (!coupon) {
        return res.status(400).json({ success: false, message: "Invalid or expired coupon" });
      }

      const alreadyUsed = coupon.usedBy.some(
        (id) => id.toString() === userId.toString()
      );

      if (alreadyUsed) {
        return res.status(400).json({ success: false, message: "Coupon already used" });
      }

      if (subTotal < coupon.minimumPrice) {
        return res.status(400).json({
          success: false,
          message: `Order total must be at least ₹${coupon.minimumPrice} to use this coupon`,
        });
      }

      discount = parseFloat(coupon.offerPrice);
    }

    const subTotalNum = parseFloat(subTotal);
    const orderTotalNum = parseFloat(orderTotal);
    const finalAmount = subTotalNum - discount;

    if (isNaN(subTotalNum) || isNaN(orderTotalNum)) {
      return res.status(400).json({ success: false, message: "Invalid subtotal or order total" });
    }

    if (Math.abs(orderTotalNum - finalAmount) > 0.01) {
      return res.status(400).json({ success: false, message: "Order total mismatch" });
    }

    if (paymentMethod === "cod" && finalAmount > 1000) {
      return res.status(400).json({
        success: false,
        message: "COD not allowed for orders above ₹1000",
      });
    }

    if (paymentMethod === "wallet") {
      const user = await User.findById(userId);
      if (!user || user.wallet < finalAmount) {
        return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
      }
    }

    for (const item of cart.items) {
      item.productId.quantity -= item.quantity;
      item.productId.totalSold = (item.productId.totalSold || 256) + item.quantity;
      await item.productId.save();
    }

    const orderItems = cart.items.map((item) => ({
      productId: item.productId._id,
      quantity: item.quantity,
      price: item.price,
    }));

    function generateTenDigitNumber() {
      return Math.floor(1000000000 + Math.random() * 9000000000);
    }

    const newOrder = new Order({
      userId,
      orderId: generateTenDigitNumber(),
      items: orderItems,
      address: userAddress._id,
      paymentMethod,
      finalAmount: orderTotalNum,
      subTotal: subTotalNum,
      discount,
      status: "Processing",
      couponApplied: !!couponCode,
      selectedAddressId: addressId,
    });

    await newOrder.save();

    if (couponCode) {
      await Coupon.updateOne(
        { name: couponCode },
        { $addToSet: { usedBy: userId } }
      );
    }

    if (req.session.coupon) {
      delete req.session.coupon;
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
         
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    if (paymentMethod === "wallet") {
      const transaction = {
        transactionId: `WAL${Date.now()}`,
        type: "debit",
        amount: finalAmount,
        date: new Date(),
      };

      // If single product, set productId; otherwise, set description
      if (cart.items.length === 1) {
        transaction.productId = cart.items[0].productId._id;
      } else {
        transaction.description = `Payment for order #${newOrder.orderId}`;
      }

      await User.updateOne(
        { _id: userId },
        {
          $inc: { wallet: -finalAmount },
          $push: { walletHistory: transaction },
        }
      );
    }

    await Cart.findOneAndDelete({ userId });

    return res.status(200).json({
      success: true,
      message: "Order placed successfully",
      orderId: newOrder.orderId,
    });
  } catch (error) {
  
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};





const loadaddAddress = async (req, res) => {
  try {
    const user = req.session.user;
    res.render("checkout-addAddress", { user });
  } catch (error) {
  
    res.redirect("/pageNotFound");
  }
};

const addAddress = async (req, res) => {
  try {
    const user = req.session.user;
    res.render("add-address", { user });
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const postAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    const {
      addressType,
      name,
      city,
      landMark,
      state,
      pincode,
      phone,
      altPhone,
    } = req.body;

    const userAddress = await Address.findOne({ userId: userData._id });
    if (!userAddress) {
      const newAddress = new Address({
        userId: userData._id,
        address: [
          {
            addressType,
            name,
            city,
            landMark,
            state,
            pincode,
            phone,
            altPhone,
          },
        ],
      });
      await newAddress.save();
    } else {
      userAddress.address.push({
        addressType,
        name,
        city,
        landMark,
        state,
        pincode,
        phone,
        altPhone,
      });
      await userAddress.save();
    }
    res.redirect("/checkout");
  } catch (error) {
   
    res.redirect("/pageNotFound");
  }
};

const loadeditAddress = async (req, res) => {
  try {
    const addressId = req.query.id;
    const user = req.session.user;
    const currAddress = await Address.findOne({ "address._id": addressId });

    if (!currAddress) {
      return res.redirect("/pageNotFound");
    }
    const addressData = currAddress.address.find(
      (item) => item._id.toString() === addressId.toString()
    );
    if (!addressData) {
      return res.redirect("/pageNotFound");
    }
    res.render("checkout-editAddress", { address: addressData, user });
  } catch (error) {
   
    res.redirect("/pageNotFound");
  }
};

const EditAddresspost = async (req, res) => {
  try {
    const {
      addressType,
      name,
      city,
      landMark,
      state,
      pincode,
      phone,
      altPhone,
    } = req.body;
    const addressId = req.query.id;
    const findAddress = await Address.findOne({ "address._id": addressId });

    if (!findAddress) {
      return res.redirect("/pageNotFound");
    }

    await Address.updateOne(
      { "address._id": addressId },
      {
        $set: {
          "address.$": {
            _id: addressId,
            addressType,
            name,
            city,
            landMark,
            state,
            pincode,
            phone,
            altPhone,
          },
        },
      }
    );
    res.redirect("/checkout");
  } catch (error) {
  
    res.redirect("/pageNotFound");
  }
};

const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId, amount, paymentMethod, couponCode } = req.body;

    if (!addressId || !paymentMethod) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({
          success: false,
          message: "Address and payment method are required",
        });
    }

    const userAddress = await Address.findOne({ userId });
    if (!userAddress) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ success: false, message: "User address not found" });
    }

    const selectedAddress = userAddress.address.find(
      (addr) => addr._id.toString() === addressId
    );
    if (!selectedAddress) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ success: false, message: "Selected address not found" });
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Cart is empty" });
    }

    for (const item of cart.items) {
      if (!item.productId) {
        return res
          .status(STATUS_CODES.BAD_REQUEST)
          .json({
            success: false,
            message: `Product not found for item: ${
              item.productName || "Unknown"
            }`,
          });
      }
      if (item.productId.quantity < item.quantity) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: `Not enough stock for ${item.productId.productName}`,
        });
      }
    }

    const subTotal = cart.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
   
    let discount = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({
        name: couponCode,
        isList: true,
        expireOn: { $gt: new Date() },
      });

      if (!coupon) {
        return res.status(400).json({ success: false, message: "Invalid or expired coupon" });
      }

      const alreadyUsed = coupon.usedBy.some(
        (id) => id.toString() === userId.toString()
      );

      if (alreadyUsed) {
        return res.status(400).json({ success: false, message: "Coupon already used" });
      }

      if (subTotal < coupon.minimumPrice) {
        return res.status(400).json({
          success: false,
          message: `Order total must be at least ₹${coupon.minimumPrice} to use this coupon`,
        });
      }

      discount = parseFloat(coupon.offerPrice);
    }

    const expectedAmountInPaise = Math.round((subTotal - discount) * 100);
    if (Math.abs(amount - expectedAmountInPaise) > 1) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ success: false, message: "Amount mismatch" });
    }
    function generateTenDigitNumber() {
      return Math.floor(1000000000 + Math.random() * 9000000000);
    }

    const newOrder = new Order({
      userId,
      orderId: generateTenDigitNumber(),
      items: cart.items.map((item) => ({
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.price,
      })),
      address: userAddress._id,
      selectedAddressId: addressId,
      paymentMethod,
      finalAmount: amount / 100,
      subTotal,
      discount,
      status: "Pending",
      couponApplied: !!couponCode,
    });

    await newOrder.save();

       if (couponCode) {
      await Coupon.updateOne(
        { name: couponCode },
        { $addToSet: { usedBy: userId } }
      );
    }

    
    if (req.session.coupon) {
      delete req.session.coupon;
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
        
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    const razorpayOrder = await razorpayInstance.orders.create({
      amount,
      currency: "INR",
      receipt: `receipt_${newOrder._id}`,
    });

    res.status(200).json({
      success: true,
      razorpaykeyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      orderId: newOrder._id,
    });
  } catch (error) {
  
    res
      .status(STATUS_SERVER_ERROR)
      .json({
        success: false,
        message: error.message || "Failed to create Razorpay order",
      });
  }
};

const razorPayment = async (req, res) => {
  try {
    const amount = req.query.amount;
    const order = await razorpayInstance.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });
    res.json({ success: true, order });
  } catch (error) {

    res.json({ success: false, message: "Failed to create Razorpay order" });
  }
};

const verifyRazorPayment = async (req, res) => {
  try {
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature, orderId } =
      req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const generated_signature = crypto
      .createHmac("sha256", secret)
      .update(razorpayOrderId + "|" + razorpayPaymentId)
      .digest("hex");

    if (generated_signature !== razorpaySignature) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ success: false, message: "Invalid payment signature" });
    }

    const order = await Order.findById(orderId).populate("items.productId");
    if (!order) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ success: false, message: "Order not found" });
    }

    for (const item of order.items) {
      if (item.productId) {
        if (item.productId.quantity < item.quantity) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: `Stock no longer available for ${item.productId.productName}`,
          });
        }
        item.productId.quantity -= item.quantity;
        item.productId.totalSold =
          (item.productId.totalSold || 0) + item.quantity;
        await item.productId.save();
      }
    }

    order.status = "Processing";
    order.razorpayPaymentId = razorpayPaymentId;
    order.razorpayOrderId = razorpayOrderId;
    await order.save();

    await Cart.findOneAndDelete({ userId: order.userId });

    res.json({ success: true, orderId: order._id });
  } catch (error) {
    
    res
      .status(STATUS_SERVER_ERROR)
      .json({
        success: false,
        message: error.message || "Failed to verify payment",
      });
  }
};

const orderSuccess = async (req, res) => {
  try {
    const user = req.session.user;
    const { orderId } = req.params;

    if (!user) {
      return res
        .status(STATUS_CODES.SERVER_ERROR)
        .json({ success: false, message: "User not authenticated" });
    }

    let order;
    if (mongoose.isValidObjectId(orderId)) {
      order = await Order.findById(orderId)
        .populate("items.productId")
        .lean();
    } else {
      order = await Order.findOne({ orderId })
        .populate("items.productId")
        .lean();
    }

    if (!order) {
      return res
        .status(STATUS_NOT_FOUND)
        .json({ success: false, message: "Order not found!" });
    }

  

    res.render("order-success", { order, user });

  } catch (error) {
   
    return res
      .status(STATUS_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
  }
};
const handlePaymentDismissal = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        status: "Payment Pending",
        "paymentDetails.failureReason": "Payment dismissed by user",
      },
      { new: true }
    );

    if (!order) {
      return res
        .status(STATUS_NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    res.json({
      success: true,
      message: "Order status updated to Payment Pending",
      orderId: order.orderId,
    });
  } catch (error) {
    
    res
      .status(STATUS_SERVER_ERROR)
      .json({ success: false, message: "Failed to handle payment dismissal" });
  }
};

const handlePaymentFailure = async (req, res) => {
  try {
    const { orderId, failureReason } = req.body;

    if (!mongoose.isValidObjectId(orderId)) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        status: "Payment Failed",
        "paymentDetails.failureReason": failureReason || "Payment failed",
        "paymentDetails.succeededAt": null,
      },
      { new: true }
    );

    if (!order) {
      return res
        .status(STATUS_NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Payment failure recorded" });
  } catch (error) {
  
    res
      .status(STATUS_SERVER_ERROR)
      .json({ success: false, message: "Failed to handle payment failure" });
  }
};

const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId || !mongoose.isValidObjectId(orderId)) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({
          success: false,
          message: "Order ID is required and must be valid",
        });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(STATUS_NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    // Check eligible statuses
    const eligibleStatuses = ["Payment Failed", "Pending", "Payment Pending"];
    if (!eligibleStatuses.includes(order.status)) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ success: false, message: "Order is not eligible for retry" });
    }

    // Update order status and payment method
    order.status = "Payment Pending"; // Set to a pending state during retry
    order.paymentMethod = "razorpay"; // Set payment method for retry
    await order.save();

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(order.finalAmount * 100),
      currency: "INR",
      receipt: `retry_${order._id}`,
    });

    const razorpayOptions = {
      key: process.env.RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      currency: "INR",
      name: "Male Fashion",
      description: `Retry Payment for Order #${order.orderId}`,
      order_id: razorpayOrder.id,
      prefill: {
        name: req.session.user?.name || "",
        email: req.session.user?.email || "",
        contact: req.session.user?.mobile || "",
      },
      notes: {
        orderId: order._id.toString(),
      },
      theme: {
        color: "#7971ea",
      },
    };

    res.status(200).json({
      success: true,
      paymentMethod: "razorpay",
      razorpayOptions,
    });
  } catch (error) {

    res
      .status(STATUS_SERVER_ERROR)
      .json({ success: false, message: "Server error: " + error.message });
  }
};

const loadTransactionFailurePage = async (req, res) => {
  try {
    const { orderId } = req.query;

    if (!orderId || !mongoose.isValidObjectId(orderId)) {
      return res.status(STATUS_CODES.BAD_REQUEST).render("error", {
        message: "Invalid or missing order ID",
        user: req.session.user,
      });
    }
    const order = await Order.findById(orderId)
      .populate("items.productId")
      .lean();

    if (!order) {
      return res.status(STATUS_NOT_FOUND).render("error", {
        message: "Order not found",
        user: req.session.user,
      });
    }

    const user = req.session.user;

    res.render("transcation-failure", {
      orderId,
      order,
      user,
      formatCurrency: (amount) =>
        new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
        }).format(amount),
    });
  } catch (error) {
  
    res.status(STATUS_SERVER_ERROR).render("error", {
      message: "Server error",
      user: req.session.user,
    });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId)
      .populate("items.productId")
      .populate("address");

    if (!order) {
      return res
        .status(STATUS_NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    const allowedStatuses = [
      
      "Delivered",
     
    ];
    if (!allowedStatuses.includes(order.status)) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message:
          "Invoice can only be downloaded for orders in  Delivered"
      });
    }

    const data = {
      documentTitle: "INVOICE",
      currency: "INR",
      taxNotation: "gst",
      marginTop: 25,
      marginRight: 25,
      marginLeft: 25,
      marginBottom: 25,
      sender: {
        company: "Satchel",
        address: "Calicut",
        zip: "682021",
        city: "Kochi",
        country: "India",
      },
      client: {
        company: order.address?.name || "Customer",
        address: `${order.address?.landMark || ""}, ${
          order.address?.city || ""
        }`,
        zip: order.address?.pincode || "",
        city: order.address?.state || "",
        country: order.address?.country || "India",
      },
      information: {
        number: order.orderId,
        date: moment(order.createOn).format("YYYY-MM-DD HH:mm:ss"),
        dueDate: order.deliveryDate
          ? moment(order.deliveryDate).format("YYYY-MM-DD HH:mm:ss")
          : moment().add(7, "days").format("YYYY-MM-DD HH:mm:ss"),
      },
      products: order.items
        .filter((item) => item.cancelStatus !== "Cancelled")
        .map((item) => ({
          quantity: item.quantity,
          description: item.productId?.productName || "Product",
          tax: 0,
          price: item.price,
        })),
      bottomNotice:
        `Subtotal: ₹${order.originalSubTotal.toFixed(2)}\n` +
        (order.discount > 0
          ? `Discount: -₹${order.discount.toFixed(2)}\n`
          : "") +
        (order.couponApplied ? `Coupon Applied: Yes\n` : "") +
        `Final Amount: ₹${order.originalFinalAmount.toFixed(2)}`,
    };

    const result = await easyinvoice.createInvoice(data);
    const invoicePath = path.resolve(
      "public/invoice",
      `invoice_${order.orderId}.pdf`
    );

    const invoiceDir = path.dirname(invoicePath);
    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir, { recursive: true });
    }

    fs.writeFileSync(invoicePath, result.pdf, "base64");

    res.download(invoicePath, `invoice_${order.orderId}.pdf`, (err) => {
      if (err) {
      
        res
          .status(STATUS_SERVER_ERROR)
          .json({ success: false, message: "Error downloading the invoice" });
      }
      try {
        fs.unlinkSync(invoicePath);
      } catch (cleanupError) {
        console.error("Error cleaning up invoice file:", cleanupError);
      }
    });
  } catch (error) {
    console.error("Error generating invoice:", error);
    res
      .status(STATUS_SERVER_ERROR)
      .json({
        success: false,
        message: "An error occurred while generating the invoice",
      });
  }
};

module.exports = {
  getCheckOut,
  placeOrder,
  loadaddAddress,
  addAddress,
  postAddress,
  loadeditAddress,
  EditAddresspost,
  createRazorpayOrder,
  verifyRazorPayment,
  orderSuccess,
  razorPayment,
  handlePaymentDismissal,
  handlePaymentFailure,
  retryPayment,
  loadTransactionFailurePage,
  downloadInvoice,
};
