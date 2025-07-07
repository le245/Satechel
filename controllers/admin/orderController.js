const Product = require("../../Models/productSchema");
const Category = require("../../Models/categorySchema");
const User = require("../../Models/userSchema");
const Order=require("../../Models/orderSchema")
const Cart=require("../../Models/cartSchema")
const Address=require("../../Models/addressSchema")

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
      return res.status(404).render('pageerror', { message: 'Order not found' });
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

    const order = await Order.findOne({ _id: orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const currentStatus = order.status;

    if (currentStatus === 'Delivered') {
      if (status && !['Return Request', 'Returned'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Delivered orders can only be changed to Return Request or Returned',
        });
      }
    }

    if (currentStatus === 'Shipped' && (status === 'Pending' || status === 'Processing')) {
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

    if (action === 'initiateReturn' && currentStatus === 'Delivered') {
      order.status = 'Return Request';
      let updatedItems = false;
      if (itemId) {
        const item = order.items.id(itemId);
        if (item && item.returnStatus === 'Not Requested') {
          item.returnStatus = 'Requested';
          item.returnRequestedAt = new Date();
          item.returnReason = returnReason || 'No reason provided';
          updatedItems = true;
        }
      } else {
        order.items.forEach(item => {
          if (item.returnStatus === 'Not Requested') {
            item.returnStatus = 'Requested';
            item.returnRequestedAt = new Date();
            item.returnReason = returnReason || 'No reason provided';
            updatedItems = true;
          }
        });
      }
      if (!updatedItems) {
        console.log('No items updated for return request');
      }
    } else {
      if (status) {
        if (status === 'Delivered' && ['Return Request', 'Returned'].includes(currentStatus)) {
          return res.status(400).json({
            success: false,
            message: 'Cannot move Return Request or Returned orders back to Delivered',
          });
        }

        order.status = status;

        if (status === 'Delivered') {
          order.invoiceDate = new Date();
        } else if (status === 'Return Request' && currentStatus !== 'Delivered') {
          return res.status(400).json({
            success: false,
            message: 'Return Request can only be set from Delivered status',
          });
        }
      }
    }

    await order.save();

    res.json({
      success: true,
      message: 'Order status updated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const approveReturn = async (req, res) => {
  try {
    const { orderId, productId } = req.body;


    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(400).json({ success: false, message: 'Order not found' });
    }

    const item = order.items.find(item => item._id.toString() === productId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Product not found in order' });
    }

  
    if (item.returnStatus !== 'Requested') {
      return res.status(400).json({ success: false, message: 'No return request found' });
    }


    item.returnStatus = 'Approved';

    
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { quantity: item.quantity }
    });

    
    if (order.paymentMethod !== 'cod') {
      const user = await User.findById(order.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const refundAmount = item.price * item.quantity;

   
      user.wallet = (user.wallet || 0) + refundAmount;

      user.walletHistory.push({
        transactionId: `TXN${Date.now()}`,
        type: 'credit',
        amount: refundAmount,
        date: new Date(),
        status: 'Completed'
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

    return res.status(200).json({
      success: true,
      message: 'Return approved successfully',
      updatedStatus: order.status
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


const rejectReturn = async (req, res) => {
  try {
    const { orderId, productId } = req.body;

    
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(400).json({ success: false, message: 'Order not found' });
    }

    
    const item = order.items.find(item => item._id.toString() === productId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Product not found in order' });
    }

  
    if (item.returnStatus !== 'Requested') {
      return res.status(400).json({ success: false, message: 'No return request found' });
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
    return res.status(200).json({
      success: true,
      message: 'Return request rejected successfully',
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};



module.exports={getListOfOrders,
    getOrderDetailsPage ,
     updateStatus,
     approveReturn,
     rejectReturn
}
