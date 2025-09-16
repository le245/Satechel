const User = require("../../Models/userSchema");
const Product= require("../../Models/productSchema");
const Category= require("../../Models/categorySchema")
const Order= require("../../Models/orderSchema");
const Coupon = require("../../Models/couponSchema");
const bcrypt = require("bcrypt");
const ExcelJS = require('exceljs');
const { format } = require('date-fns');
const PDFDocument = require('pdfkit-table');
const STATUS_CODES= require("../../Models/status")


const loadLogin = async (req, res) => {

    if (req.session.admin) {
        return res.redirect("/admin/dashboard");
    }
    res.render("adminlogin.ejs", { msg: req.session.message });
                                                                           
};


const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            req.session.message = "Email and password are required.";
            return res.redirect("/admin/login");
        }

        const admin = await User.findOne({ email, isAdmin: true });
        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = admin._id; 
                return res.redirect("/admin/dashboard");
            } else {
                req.session.message = "Invalid password";
                return res.redirect("/admin/login");
            }
        } else {
            req.session.message = "Admin not found";
            return res.redirect("/admin/login");
        }
    } catch (error) {
        console.error("Login error:", error);
        req.session.message = "Server error during login";
        return res.redirect("/admin/login");
    }
};



const pageerror = async (req, res) => {
    try {
        res.render("pageerror");
    } catch (error) {
       

     res.status(STATUS_CODES.SERVER_ERROR).send("Internal Server Error");
    }
};

const logout = async (req, res) => {
    try {
        delete req.session.admin;

        res.redirect("/admin/login"); 
    } catch (error) {
        res.redirect("/pageerror");
    }
};


const getSalesData = async (dateFilter, filterType = 'daily') => {
  let dateFormat;
  switch (filterType.toLowerCase()) {
    case 'daily':
      dateFormat = '%Y-%m-%d';
      break;
    case 'weekly':
      dateFormat = '%Y-W%U';
      break;
    case 'monthly':
      dateFormat = '%Y-%m';
      break;
    case 'yearly':
      dateFormat = '%Y';
      break;
    case 'custom':
      dateFormat = '%Y-%m-%d';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  const result = await Order.aggregate([


           { $match: { ...dateFilter, status: 'Delivered' } },

    
    
           { $unwind: '$orderedItems' },


    
    {
      $project: {
        createdOn: 1,
        itemRevenue: {
          $multiply: [
            {
              $ifNull: [
                '$orderedItems.salesPrice',
                '$orderedItems.regularPrice',
              ],
            },
            '$orderedItems.quantity',
          ],
        },
      },
    },


    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$createdOn' } },
        revenue: { $sum: '$itemRevenue' },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: '$_id', revenue: 1, orderCount: 1, _id: 0 } },
  ]);



  
  
  
  return result;
};



const { startOfDay, endOfDay, subDays, subWeeks, subMonths, subYears } = require('date-fns');


const createDateFilter = (filter, startDate, endDate) => {
  const today = new Date();
  let start, end;

          switch (filter) {
    case 'daily':
      start = startOfDay(today);
      end = endOfDay(today);
      break;
    case 'weekly':
      start = startOfDay(subWeeks(today, 1));
      end = endOfDay(today);
      break;
    case 'monthly':
      start = startOfDay(subMonths(today, 1));
      end = endOfDay(today);
      break;
    case 'yearly':
      start = startOfDay(subYears(today, 1));
      end = endOfDay(today);
      break;
    case 'custom':
      start = startOfDay(new Date(startDate));
      end = endOfDay(new Date(endDate));
      break;
    default:
      start = startOfDay(today);
      end = endOfDay(today);
  }

             return { createOn: { $gte: start, $lte: end } };
};
const getBestSellingProducts = async (dateFilter) => {
  try {
    const products = await Order.aggregate([
      { $match: dateFilter },

                    { $unwind: '$items' },

          {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'productInfo',
        },
      },



      {
        $group: {
          _id: '$items.productId',
          name: { $first: { $arrayElemAt: ['$productInfo.productName', 0] } },
          revenue: { $sum: '$items.price' },
          quantity: { $sum: '$items.quantity' },
        },
      },


      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    return products.map((p) => ({
      name: p.name || 'Unknown Product',
      revenue: p.revenue || 0,
      quantity: p.quantity || 0,
    }));
  } catch (error) {
    console.error('Error in getBestSellingProducts:', error);
    return [];
  }
};
const getBestCategories = async (dateFilter) => {
  try {
    const categories = await Order.aggregate([
      { $match: dateFilter },

      { $unwind: '$items' },

      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'productInfo.category',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      {
        $group: {
          _id: { $arrayElemAt: ['$categoryInfo._id', 0] },
          name: { $first: { $arrayElemAt: ['$categoryInfo.name', 0] } },
          revenue: { $sum: '$items.price' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    return categories.map((c) => ({
      name: c.name || 'Unknown Category',
      revenue: c.revenue || 0,
    }));
  } catch (error) {
    console.error('Error in getBestCategories:', error);
    return [];
  }
};

const loadDashboard = async (req, res) => {
  const { page = 1, filter = 'daily', startDate, endDate } = req.query;
  const limit = 6;

  try {
    if (filter === 'custom') {
      if (!startDate || !endDate) {
        throw new Error('Start date and end date are required for custom filter.');
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date format for start date or end date.');
      }

      if (end < start) {
        throw new Error('End date cannot be before start date.');
      }

      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (start > today || end > today) {
        throw new Error('Dates cannot be in the future.');
      }
    }

    const dateFilter = createDateFilter(filter, startDate, endDate);

    const [
      totalOrders,
      salesSummary,
      orders,
      totalUsers,
      totalProducts,
      totalCoupons,
      bestSellingProducts,
      bestCategories,
      salesData,
    ] = await Promise.all([
      Order.countDocuments(dateFilter),
      Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$finalAmount' },
            totalDiscount: { $sum: '$discount' },
          },
        },
      ]),
      Order.find(dateFilter)
        .populate('items.productId', 'productName')
        .sort({ createOn: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(),
      Product.countDocuments(),
      Coupon.countDocuments(),
      getBestSellingProducts(dateFilter),
      getBestCategories(dateFilter),
      getSalesData(dateFilter),
    ]);

    const responseData = {
      totalOrders,
      totalSales: salesSummary[0]?.totalSales || 0,
      totalDiscount: salesSummary[0]?.totalDiscount || 0,
      orders,
      totalUsers,
      totalProducts,
      totalCoupons,
      bestSellingProducts,
      bestCategories,
      salesData,
      totalPages: Math.ceil(totalOrders / limit),
      currentPage: parseInt(page),
      selectedFilter: filter,
      startDate: startDate || '',
      endDate: endDate || '',
    };

    res.render('dashboard', responseData);
  } catch (error) {
    console.error('Error loading dashboard:', error.message);
    res.render('dashboard', {
      totalOrders: 0,
      totalSales: 0,
      totalDiscount: 0,
      orders: [],
      totalUsers: 0,
      totalProducts: 0,
      totalCoupons: 0,
      bestSellingProducts: [],
      bestCategories: [],
      salesData: [],
      totalPages: 0,
      currentPage: 1,
      selectedFilter: filter || 'daily',
      startDate: startDate || '',
      endDate: endDate || '',
      errorMessage: error.message,
    });
  }
};

const generateSalesReport = async (req, res) => {
  try {
    const { filter = 'daily', startDate, endDate } = req.query;
    const dateFilter = createDateFilter(filter, startDate, endDate);

    const orders = await Order.aggregate([
      { $match: dateFilter },

      
      { $unwind: '$items' },




      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'productInfo',
        },
      },


      
      {
        $group: {
          _id: '$_id',
          orderId: { $first: '$orderId' },
          createOn: { $first: '$createOn' },
          totalPrice: { $first: '$subTotal' },
          discount: { $first: '$discount' },
          finalAmount: { $first: '$finalAmount' },
          couponCode: { $first: '$couponApplied' ? 'Applied' : 'N/A' },
          items: {
            $push: {
              productName: { $arrayElemAt: ['$productInfo.productName', 0] },
              quantity: '$items.quantity',
              price: '$items.price',
            },
          },
        },
      },
    ]);

    const summary = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: '$subTotal' },
          totalDiscount: { $sum: '$discount' },
          finalAmount: { $sum: '$finalAmount' },
        },
      },
    ]);

    res.render('admin/sales-report', {
      filter,
      startDate,
      endDate,
      orders,
      summary: summary[0] || {},
    });
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.redirect('/admin/pageerror');
  }
};

const downloadExcelReport = async (req, res) => {
  try {
    const { filter = 'daily', startDate, endDate } = req.query;
    const dateFilter = createDateFilter(filter, startDate, endDate);

    const queryFilter = {
      ...dateFilter,
      status: 'Delivered',
    };

    const orders = await Order.find(queryFilter).populate('items.productId');
    const summary = await Order.aggregate([
      { $match: queryFilter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: '$subTotal' },
          totalDiscount: { $sum: '$discount' },
          finalAmount: { $sum: '$finalAmount' },
        },
      },
    ]);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.addRow(['Sales Report']);
    worksheet.addRow(['Filter:', filter]);
    worksheet.addRow([
      'Date Range:',
      `${format(dateFilter.createOn.$gte, 'yyyy-MM-dd')} to ${format(dateFilter.createOn.$lte, 'yyyy-MM-dd')}`,
    ]);
    worksheet.addRow([]);

    worksheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Product', key: 'product', width: 25 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Price', key: 'price', width: 12 },
      { header: 'Discount', key: 'discount', width: 12 },
      { header: 'Final Amount', key: 'finalAmount', width: 12 },
      { header: 'Coupon', key: 'coupon', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    orders.forEach((order) => {
      order.items.forEach((item) => {
        worksheet.addRow({
          orderId: order.orderId,
          date: format(order.createOn, 'yyyy-MM-dd'),
          product: item.productId?.productName || 'N/A',
          quantity: item.quantity || 0,
          price: item.price || 0,
          discount: order.discount,
          finalAmount: order.finalAmount,
          coupon: order.couponApplied ? 'Applied' : 'N/A',
          status: order.status || 'N/A',
        });
      });
    });

    worksheet.addRow([]);
    worksheet.addRow(['Summary']);
    const sum = summary[0] || {};
    worksheet.addRow(['Total Orders:', sum.totalOrders || 0]);
    worksheet.addRow(['Total Amount:', sum.totalAmount || 0]);
    worksheet.addRow(['Total Discount:', sum.totalDiscount || 0]);
    worksheet.addRow(['Final Amount:', sum.finalAmount || 0]);

    ['price', 'discount', 'finalAmount'].forEach((key) => {
      worksheet.getColumn(key).numFmt = '₹#,##0.00';
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=SalesReport.xlsx'
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel:', error);
    res.redirect('/admin/pageerror');
  }
};

const downloadPDFReport = async (req, res) => {
  try {
    const { filter = 'daily', startDate, endDate } = req.query;
    const dateFilter = createDateFilter(filter, startDate, endDate);

    const queryFilter = {
      ...dateFilter,
      status: 'Delivered',
    };

    const orders = await Order.find(queryFilter).populate('items.productId');
    const summary = await Order.aggregate([
      { $match: queryFilter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: '$subTotal' },
          totalDiscount: { $sum: '$discount' },
          finalAmount: { $sum: '$finalAmount' },
        },
      },
    ]);

    const doc = new PDFDocument({ margin: 30 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=SalesReport.pdf'
    );

    doc.pipe(res);

    doc.fontSize(20).text('Sales Report', { align: 'center' });

    doc
      .fontSize(12)
      .text(`Filter: ${filter}`)
      .text(
        `Date Range: ${
          dateFilter.createOn?.$gte
            ? format(dateFilter.createOn.$gte, 'yyyy-MM-dd')
            : 'N/A'
        } to ${
          dateFilter.createOn?.$lte
            ? format(dateFilter.createOn.$lte, 'yyyy-MM-dd')
            : 'N/A'
        }`
      );
    doc.moveDown();

    const tableData = orders.flatMap((order) =>
      order.items.map((item) => ({
        orderId: order.orderId?.slice(0, 12) || 'N/A',
        date: format(order.createOn, 'yyyy-MM-dd'),
        product: item.productId?.productName || 'N/A',
        qty: item.quantity || 0,
        price: `₹${(item.price || 0).toFixed(2)}`,
        discount: `₹${(order.discount || 0).toFixed(2)}`,
        final: `₹${(order.finalAmount || 0).toFixed(2)}`,
        status: order.status || 'N/A',
      }))
    );

    if (tableData.length === 0) {
      doc
        .fontSize(12)
        .text('No delivered orders found for the selected date range.', {
          align: 'center',
        });
    } else {
      const table = {
        headers: [
          { label: 'Order ID', property: 'orderId', width: 90 },
          { label: 'Date', property: 'date', width: 70 },
          { label: 'Product', property: 'product', width: 110 },
          { label: 'Qty', property: 'qty', width: 40 },
          { label: 'Price', property: 'price', width: 60 },
          { label: 'Discount', property: 'discount', width: 60 },
          { label: 'Final', property: 'final', width: 60 },
          { label: 'Status', property: 'status', width: 60 },
        ],
        datas: tableData,
      };

      await doc.table(table, {
        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
        prepareRow: () => doc.font('Helvetica').fontSize(9),
      });
    }

    doc
      .moveDown()
      .fontSize(12)
      .text('Summary', { underline: true })
      .fontSize(11);

    const sum = summary[0] || {};
    doc
      .text(`Total Orders: ${sum.totalOrders || 0}`)
      .text(`Total Amount: ₹${(sum.totalAmount || 0).toFixed(2)}`)
      .text(`Total Discount: ₹${(sum.totalDiscount || 0).toFixed(2)}`)
      .text(`Final Amount: ₹${(sum.finalAmount || 0).toFixed(2)}`);

    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.redirect('/admin/pageerror');
  }
};

const getAnalyticsData = async (req, res) => {
  try {
    const { filter = 'daily', startDate, endDate } = req.query;
    const dateFilter = createDateFilter(filter, startDate, endDate);

    const [bestSellingProducts, bestCategories, salesData] = await Promise.all([
      getBestSellingProducts(dateFilter),
      getBestCategories(dateFilter),
      getSalesData(dateFilter),
    ]);

    res.json({ bestSellingProducts, bestCategories, salesData });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(STATUS_CODES.SERVER_ERROR).json({ error: error.message });
  }
};
const getTopPerformers = async (req, res) => {
  try {
    const { filter = 'daily', startDate, endDate } = req.query;
    const dateFilter = createDateFilter(filter, startDate, endDate);

    const [products, categories] = await Promise.all([
      getBestSellingProducts(dateFilter),
      getBestCategories(dateFilter),
    ]);

    res.json({ products, categories });
  } catch (error) {
    console.error('Error fetching top performers:', error);
    res.status(STATUS_CODES.SERVER_ERROR).json({ error: error.message });
  }
};

module.exports = {
    loadLogin,
    login,
    pageerror,
    logout,
    loadDashboard,
    getAnalyticsData,
    getTopPerformers,
    generateSalesReport,
    downloadExcelReport,
    downloadPDFReport
};