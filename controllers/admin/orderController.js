const Product = require("../../Models/productSchema");
const Category = require("../../Models/categorySchema");
const User = require("../../Models/userSchema");
const Order=require("../../Models/orderSchema")
const Cart=require("../../Models/cartSchema")
const Address=require("../../Models/addressSchema")
const STATUS_CODES= require("../../Models/status")


const getListOfOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    const orders = await Order.find()
      .populate('userId', 'name email')
      .populate('address')
      .sort({ createOn: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    const totalOrders = await Order.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit);

    res.render('orders', {
      orders,
      totalPages,
      currentPage: page
    });
  } catch (error) {

    res.redirect('/admin/pageerror'); 
  }
};


const getOrderDetailsPage = async (req, res) => {
  try {
    const orderId = req.params.orderId; 

    
    const order = await Order.findOne({ orderId })
      .populate('items.productId')   
      .populate('address')     
      .populate('userId')          
      .lean();                       

  
    if (!order) {
      return res.status(STATUS_NOT_FOUND).render('pageerror', { message: 'Order not found' });
    }

   
    res.render('orderDetails', { order, user: req.session.user });

  } catch (error) {
  
    res.redirect('/admin/pageerror');
  }
};




const updateStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, action, returnReason, itemId } = req.body;

        if (!orderId || typeof orderId !== 'string') {
            return res.status(400).json({ success: false, message: 'Invalid order ID format' });
        }

        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const currentStatus = order.status;
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'ReturnRequest', 'Returned'];

        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        if (currentStatus === 'Delivered' && status && !['ReturnRequest', 'Returned'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Delivered orders can only be changed to ReturnRequest or Returned',
            });
        }

        if (currentStatus === 'Shipped' && status && (status === 'Pending' || status === 'Processing')) {
            return res.status(400).json({
                success: false,
                message: 'Shipped orders cannot be changed to Pending or Processing',
            });
        }

        if (currentStatus === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Cancelled orders cannot be changed to another status',
            });
        }

        const determineOrderStatus = (items) => {
            const activeItems = items.filter(item => item.cancelStatus !== 'Cancelled');
            if (activeItems.length === 0) return 'Cancelled';
            if (activeItems.some(item => item.returnStatus === 'Requested')) return 'ReturnRequest';
            if (activeItems.every(item => item.returnStatus === 'Approved' || item.returnStatus === 'Rejected')) return 'Returned';
            return status || currentStatus;
        };

        if (action === 'cancelItem' && itemId) {
            if (!mongoose.Types.ObjectId.isValid(itemId)) {
                return res.status(400).json({ success: false, message: 'Invalid item ID format' });
            }

            const item = order.items.id(itemId);
            if (!item) {
                return res.status(404).json({ success: false, message: 'Item not found in order' });
            }

            if (item.cancelStatus === 'Cancelled') {
                return res.status(400).json({ success: false, message: 'Item is already cancelled' });
            }

            if (item.returnStatus !== 'Not Requested') {
                return res.status(400).json({ success: false, message: 'Cannot cancel an item with an active return request' });
            }

            item.cancelStatus = 'Cancelled';
            order.status = determineOrderStatus(order.items);
        } else if (action === 'initiateReturn' && currentStatus === 'Delivered') {
            if (!itemId && order.items.length > 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Item ID is required for orders with multiple items',
                });
            }

            let updatedItems = false;
            if (itemId) {
                if (!mongoose.Types.ObjectId.isValid(itemId)) {
                    return res.status(400).json({ success: false, message: 'Invalid item ID format' });
                }

                const item = order.items.id(itemId);
                if (!item) {
                    return res.status(404).json({ success: false, message: 'Item not found in order' });
                }

                if (item.returnStatus === 'Not Requested' && item.cancelStatus !== 'Cancelled') {
                    item.returnStatus = 'Requested';
                    item.returnRequestedAt = new Date();
                    item.returnReason = returnReason || 'No reason provided';
                    updatedItems = true;
                } else {
                    return res.status(400).json({
                        success: false,
                        message: 'Item is not eligible for return request (already requested or cancelled)',
                    });
                }
            } else {
                order.items.forEach(item => {
                    if (item.returnStatus === 'Not Requested' && item.cancelStatus !== 'Cancelled') {
                        item.returnStatus = 'Requested';
                        item.returnRequestedAt = new Date();
                        item.returnReason = returnReason || 'No reason provided';
                        updatedItems = true;
                    }
                });
            }

            if (!updatedItems) {
                return res.status(400).json({ success: false, message: 'No eligible items updated for return request' });
            }

            order.status = determineOrderStatus(order.items);
        } else if (status === 'ReturnRequest' && currentStatus === 'Delivered') {
            let updatedItems = false;
            if (itemId) {
                if (!mongoose.Types.ObjectId.isValid(itemId)) {
                    return res.status(400).json({ success: false, message: 'Invalid item ID format' });
                }

                const item = order.items.id(itemId);
                if (!item) {
                    return res.status(404).json({ success: false, message: 'Item not found in order' });
                }

                if (item.returnStatus === 'Not Requested' && item.cancelStatus !== 'Cancelled') {
                    item.returnStatus = 'Requested';
                    item.returnRequestedAt = new Date();
                    item.returnReason = returnReason || 'No reason provided';
                    updatedItems = true;
                } else {
                    return res.status(400).json({
                        success: false,
                        message: 'Item is not eligible for return request (already requested or cancelled)',
                    });
                }
            } else {
                order.items.forEach(item => {
                    if (item.returnStatus === 'Not Requested' && item.cancelStatus !== 'Cancelled') {
                        item.returnStatus = 'Requested';
                        item.returnRequestedAt = new Date();
                        item.returnReason = returnReason || 'No reason provided';
                        updatedItems = true;
                    }
                });
            }

            if (!updatedItems) {
                return res.status(400).json({ success: false, message: 'No eligible items updated for return request' });
            }

            order.status = determineOrderStatus(order.items);
        } else if (itemId && status) {
            if (!mongoose.Types.ObjectId.isValid(itemId)) {
                return res.status(400).json({ success: false, message: 'Invalid item ID format' });
            }

            const item = order.items.id(itemId);
            if (!item) {
                return res.status(404).json({ success: false, message: 'Item not found in order' });
            }

            if (item.cancelStatus === 'Cancelled') {
                return res.status(400).json({ success: false, message: 'Cannot update status of a cancelled item' });
            }

            if (item.returnStatus !== 'Not Requested') {
                return res.status(400).json({ success: false, message: 'Cannot update status of an item with an active return request' });
            }

            item.cancelStatus = status === 'Delivered' ? 'Completed' : item.cancelStatus;
            order.status = determineOrderStatus(order.items);

            if (status === 'Delivered') {
                order.invoiceDate = new Date();
            }
        } else if (status) {
            if (status === 'Delivered' && ['ReturnRequest', 'Returned'].includes(currentStatus)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot move ReturnRequest or Returned orders back to Delivered',
                });
            }

            if (status === 'ReturnRequest' && currentStatus !== 'Delivered') {
                return res.status(400).json({
                    success: false,
                    message: 'ReturnRequest can only be set from Delivered status',
                });
            }

            order.items.forEach(item => {
                if (item.cancelStatus !== 'Cancelled') {
                    item.cancelStatus = status === 'Delivered' ? 'Completed' : item.cancelStatus;
                }
            });

            order.status = determineOrderStatus(order.items);

            if (status === 'Delivered') {
                order.invoiceDate = new Date();
            }
        } else {
            return res.status(400).json({ success: false, message: 'No valid status or action provided' });
        }

        await order.save();

        res.json({
            success: true,
            message: 'Order status updated successfully',
            updatedStatus: order.status,
        });
    } catch (error) {
     
        const orderId = req.params.orderId || 'unknown';
        res.status(500).json({ success: false, message: `Server error: ${error.message}` });
    }
};


const approveReturn = async (req, res) => {
  try {
    const { orderId, productId } = req.body;

    const order = await Order.findOne({ orderId }).populate("items.productId");

    if (!order) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Order not found' });
    }

    const item = order.items.find(item => item._id.toString() === productId);

    if (!item) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'Product not found in order' });
    }

    if (item.returnStatus !== 'Requested') {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'No return request found' });
    }

  
    item.returnStatus = 'Approved';

    
    await Product.findByIdAndUpdate(item.productId._id || item.productId, {
      $inc: { quantity: item.quantity }
    });

    
    if (order.paymentMethod !== 'cod') {
      const user = await User.findById(order.userId);
      if (!user) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'User not found' });
      }

      const discountFactor = order.subTotal > 0 ? order.finalAmount / order.subTotal : 1;
      const itemTotal = item.price * item.quantity;
      const refundAmount = itemTotal * discountFactor;

      user.wallet = (user.wallet || 0) + refundAmount;

      user.walletHistory.push({
        transactionId: `TXN${Date.now()}-${item.productId._id || item.productId}`,
        type: 'credit',
        amount: refundAmount,
        date: new Date(),
        productId: item.productId._id || item.productId,
        productName: item.productId?.productName || 'Product'
      });

      await user.save();
    }

    const allItemsProcessed = order.items.every(item =>
      item.returnStatus === 'Approved' ||
      item.returnStatus === 'Rejected' ||
      item.cancelStatus === 'Cancelled' ||
      item.returnStatus === 'Not Requested'
    );

    if (allItemsProcessed) {
      order.status = 'Returned';
    }

    await order.save();

    return res.status(STATUS_CODES.OK).json({
      success: true,
      message: 'Return approved successfully',
      updatedStatus: order.status
    });

  } catch (error) {
    
    return res.status(STATUS_CODES.SERVER_ERROR).json({
      success: false,
      message: 'An error occurred while processing your request.'
    });
  }
};


const rejectReturn = async (req, res) => {
  try {
    const { orderId, productId } = req.body;

    
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Order not found' });
    }

    
    const item = order.items.find(item => item._id.toString() === productId);
    if (!item) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'Product not found in order' });
    }

  
    if (item.returnStatus !== 'Requested') {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'No return request found' });
    }

    item.returnStatus = 'Rejected';

   
    const allItemsProcessed = order.items.every(item =>
      item.returnStatus === 'Approved' ||
      item.returnStatus === 'Rejected' ||
      item.cancelStatus === 'Cancelled' ||
      item.returnStatus === 'Not Requested'
    );

    if (allItemsProcessed) {
      order.status = 'Delivered';
    }

 
    await order.save();
    return res.status(STATUS_CODES.OK).json({
      success: true,
      message: 'Return request rejected successfully',
    });

  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR).json({ success: false, message: 'Server error' });
  }
};



module.exports={getListOfOrders,
    getOrderDetailsPage ,
     updateStatus,
     approveReturn,
     rejectReturn
}
