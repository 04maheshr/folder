const port = 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const { type } = require("os");
const { log } = require("console");
const Razorpay = require('razorpay');

app.use(express.json());

app.use(cors());
// Ensure the upload directory exists
const dir = "./upload/images";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
// DB Connection with MongoDB
mongoose.connect(
  "mongodb+srv://svamdev:CowTheGreat@cluster0.ktfkv.mongodb.net/e-commerce"
  // "mongodb+srv://svamdev:CowTheGreat@cluster0.ktfkv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
);
// API Creation
app.get("/", (req, res) => {
  res.send("Express app is running");
});
// Image Storage Engine
const storage = multer.diskStorage({
  destination: "./upload/images",
  filename: (req, file, cb) => {
    cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});
const upload = multer({ storage: storage });
//Creating Upload Endpoint for images
app.use("/images", express.static("upload/images"));
app.post("/upload", upload.single("product"), (req, res) => {
  res.json({
    success: 1,
    image_url: `http://localhost:${port}/images/${req.file.filename}`,
  });
});
// Schema for creating products
const Product = mongoose.model("Product", {
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  old_price: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  available: {
    type: Boolean,
    default: true,
  },
});
// Add a new product
app.post("/addproduct", async (req, res) => {
  try {
    let products = await Product.find({});
    let id;
    if (products.length > 0) {
      let last_product_array = products.slice(-1);
      let last_product = last_product_array[0];
      id = last_product.id + 1;
    } else {
      id = 1;
    }
    const product = new Product({
      id: id,
      name: req.body.name,
      image: req.body.image,
      category: req.body.category,
      new_price: req.body.new_price,
      old_price: req.body.old_price,
    });
    console.log(product);
    await product.save();
    console.log("Saved");
    res.json({
      success: true,
      name: req.body.name,
    });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ success: false, message: "Error adding product." });
  }
});
// Remove a product
app.post("/removeproduct", async (req, res) => {
  try {
    await Product.findOneAndDelete({ id: req.body.id });
    console.log("Removed");
    res.json({
      success: true,
      name: req.body.name,
    });
  } catch (error) {
    console.error("Error removing product:", error);
    res
      .status(500)
      .json({ success: false, message: "Error removing product." });
  }
});
// Get all products
app.get("/allproducts", async (req, res) => {
  let products = await Product.find({});
  console.log("All products fetched");
  res.send(products);
});
// Schema creating for User model
const Users = mongoose.model("Users", {
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
  },
  cartData: {
    type: Object,
  },
  phoneNumber: {
    type: String,
    required: false, // Optional
  },
  address: {
    type: String,
    required: false, // Optional
  },
  // Add any other fields you may hav

  date: {
    type: Date,
    default: Date.now,
  },
});
// Creating endpoint for registering the user
app.post("/signup", async (req, res) => {
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({
      success: false,
      error: "Existing user found for this email address",
    });
  }
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }
  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });
  await user.save();
  const data = {
    user: {
      id: user.id,
    },
  };
  const token = jwt.sign(data, "secret_ecom");
  res.json({ success: true, token });
});
// Endpoint for user login
app.post("/login", async (req, res) => {
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    const passCompare = req.body.password === user.password;
    if (passCompare) {
      const data = {
        user: {
          id: user.id,
        },
      };
      const token = jwt.sign(data, "secret_ecom");
      res.json({ success: true, token });
    } else {
      res.json({ success: false, errors: "Wrong Password" });
    }
  } else {
    res.json({ success: false, errors: "Wrong Email ID" });
  }
});
app.get("/user-profile", async (req, res) => {
  try {
    const email = req.query.email;

    // Check if email is provided
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // Find the user by email
    const profile = await Users.findOne({ email: email });
    
    if (profile) {
      const data = {
        phoneNumber: profile.phoneNumber || "nothing",
        email: profile.email || "nothing",
        address: profile.address || "nothing",
        name: profile.name || "nothing",
      };
      return res.json({ success: true, data });
    } else {
      return res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST endpoint to update user profile
app.post("/update-profile", async (req, res) => {
  try {
    const { email, userData } = req.body; // Extract email and userData from the request body

    // Check if both email and userData are provided
    if (!email || !userData) {
      return res.status(400).json({ success: false, message: "Missing email or user data" });
    }

    // Find the user by email and update the profile with the new userData
    const updatedUser = await Users.findOneAndUpdate(
      { email: email },
      { $set: userData },
      { new: true, runValidators: true } // Return the updated document and run validation
    );

    // If no user found, send an error response
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Success response with updated user data
    return res.json({ success: true, data: updatedUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
const orderSchema = new mongoose.Schema({
  razorpay_order_id: { type: String, required: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  paymentId: { type: String, required: true },
  status: { type: String, required: true },
  cartValues: { type: Array, required: true },
  email: { type: String, required: true },
  amount: { type: Number, required: true } // Ensure this line has no syntax errors
});

const Order = mongoose.model('Order', orderSchema); 


// Endpoint for newcollection
app.get("/newcollections", async (req, res) => {
  let products = await Product.find({});
  let newcollection = products.slice(-8);
  console.log("New Collection Fetched");
  res.send(newcollection);
});
// Popular Tshirts
app.get("/populartshirt", async (req, res) => {
  let products = await Product.find({ category: "tshirt" });
  let popular_tshirt = products.slice(0, 4);
  console.log("Popular Tshirt Fetched");
  res.send(popular_tshirt);
});
// Middelware to fetch user
const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    res.status(401).send({
      errors: "Please authenticate using valid token",
    });
  } else {
    try {
      const data = jwt.verify(token, "secret_ecom");
      req.user = data.user;
      next();
    } catch (error) {
      res
        .status(401)
        .send({ errors: "Please authenticate using a valid token" });
    }
  }
};

app.post("/addtocart", fetchUser, async (req, res) => {
  console.log("Added", req.body.itemId);
  let userData = await Users.findOne({ _id: req.user.id });
  // Initialize the cart for the item if it doesn't exist
  if (!userData.cartData[req.body.itemId]) {
    userData.cartData[req.body.itemId] = [0, []];
  }
  // Increment quantity
  userData.cartData[req.body.itemId][0] += 1;
  // Add customization if provided
  if (req.body.customization && req.body.size) {
    userData.cartData[req.body.itemId][1].push([
      req.body.customization,
      req.body.size,
    ]);
  }
  // Save the updated cart data
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Added to cart with customization");
});
app.post("/removefromcart", fetchUser, async (req, res) => {
  console.log("Removed", req.body.itemId);
  let userData = await Users.findOne({ _id: req.user.id });
  // Check if the item exists in the cart and its quantity is greater than 0
  if (
    userData.cartData[req.body.itemId] &&
    userData.cartData[req.body.itemId][0] > 0
  ) {
    // Decrease the quantity
    userData.cartData[req.body.itemId][0] -= 1;
    // If the quantity is 0, remove the item from the cart
    if (userData.cartData[req.body.itemId][0] === 0) {
      delete userData.cartData[req.body.itemId];
    }
    // Save the updated cart data
    await Users.findOneAndUpdate(
      { _id: req.user.id },
      { cartData: userData.cartData }
    );
    return res.json({ message: "Item removed from cart successfully." });
  } else {
    return res.status(400).json({ message: "Item not found in cart." });
  }
});
// Endpoint to get cart data
app.post("/getcart", fetchUser, async (req, res) => {
  console.log("Getcart");
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});
const razorpayInstance = new Razorpay({
  key_id: 'rzp_test_cpMZ5WyKsUNW88', // Change this to your actual key_id
  key_secret: '7lkEfakxLQizuzkpUQPbBuoJ', // Change this to your actual key_secret
});

// Middleware to parse JSON request bodies
app.post('/razorpay-order', async (req, res) => {
  console.log('Received request to create Razorpay order:', req.body);

  try {
      const { amount } = req.body;
      if (typeof amount !== 'number' || amount <= 0) {
          console.error('Valid amount is required');
          return res.status(400).send('Valid amount is required');
      }

      const options = {
          amount: amount * 100,  // Amount in currency subunits (Paisa)
          currency: "INR",
          receipt: "receipt#1",  // Unique receipts for each order
      };

      console.log('Creating Razorpay order with options:', options);

      // Create the order
      const order = await razorpayInstance.orders.create(options);
      
      if (!order) {
          console.error('Order not created in Razorpay');
          return res.status(500).send('Order creation failed');
      }

      console.log('Order created successfully:', order);

      // Send the created order details to the client
      res.json(order);
  } catch (error) {
      console.error('Error creating Razorpay order:', error);
      res.status(500).json({ message: 'Failed to create order', error: error.message });
  }
});

// Endpoint for confirming payment
app.post('/confirm-payment', async (req, res) => {
  console.log(req.body); // Log the incoming request body
  const { order_id, payment_id, cartValues, email, amount } = req.body; // Include amount

  try {
    // Find the user by email
    const user_values = await Users.findOne({ email });

    // Check if user exists
    if (!user_values) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create a new order with the payment details and user information
    const order = new Order({
      razorpay_order_id: order_id,  // Store the Razorpay order ID
      name: user_values.name,
      address: user_values.address,
      phoneNumber: user_values.phoneNumber,
      paymentId: payment_id,
      status: 'paid',
      cartValues: cartValues,
      email: user_values.email,  // Include user email
      amount: amount, // Include amount
    });

    // Save the new order details to the database
    await order.save();

    // Optional: Send a confirmation email here
    // You can use a service like nodemailer to send an email

    res.json({ message: 'Payment confirmed and order created', order });
  } catch (error) {
    console.error('Error confirming payment:', error);
    
    // Check if the error is a validation error from Mongoose
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', error: error.message });
    }
    
    res.status(500).json({ message: 'Error confirming payment', error: error.message });
  }
});



app.listen(port, (error) => {
  if (!error) {
    console.log("Server running on port " + port);
  } else {
    console.log("Error: " + error);
  }
});
