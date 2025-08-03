import userModel from "../models/userModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Razorpay from "razorpay";
import transactionModel from "../models/transactionModel.js";

// ✅ Register User
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // ✅ Check for missing details
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Missing details" });
        }

        // ✅ Check if the user already exists
        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "User already exists!" });
        }

        // ✅ Hash the password properly
        const hashedPassword = await bcrypt.hash(password, 10);

        // ✅ Save user
        const newUser = new userModel({ name, email, password: hashedPassword });
        const user = await newUser.save();

        // ✅ Generate JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

        res.status(201).json({ success: true, token, user: { name: user.name } });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ✅ Login User
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // ✅ Check for missing fields
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }

        const user = await userModel.findOne({ email });

        // ✅ Check if user exists
        if (!user) {
            return res.status(400).json({ success: false, message: "User does not exist!" });
        }

        // ✅ Ensure user has a password before comparing
        if (!user.password) {
            return res.status(500).json({ success: false, message: "No password found for this user" });
        }

        // ✅ Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
        res.json({ success: true, token, user: { name: user.name } });

    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ✅ Get User Credits
const userCredits = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await userModel.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, credits: user.creditBalance, user: { name: user.name } });
    } catch (err) {
        console.error("User Credits Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ✅ Razorpay Instance
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ✅ Razorpay Payment
const paymentRazorpay = async (req, res) => {
    try {
        const { userId, planId } = req.body;

        if (!userId || !planId) {
            return res.status(400).json({ success: false, message: "Missing details" });
        }

        const userData = await userModel.findById(userId);
        if (!userData) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        let credits, plan, amount;
        switch (planId) {
            case "Basic":
                plan = "Basic";
                credits = 100;
                amount = 10;
                break;
            case "Advanced":
                plan = "Advanced";
                credits = 500;
                amount = 50;
                break;
            case "Business":
                plan = "Business";
                credits = 5000;
                amount = 250;
                break;
            default:
                return res.status(400).json({ success: false, message: "Plan not found" });
        }

        const transactionData = { userId, plan, amount, credits, date: Date.now() };
        const newTransaction = await transactionModel.create(transactionData);

        const options = {
            amount: amount * 100,
            currency: process.env.CURRENCY,
            receipt: newTransaction._id,
        };

        razorpayInstance.orders.create(options, (error, order) => {
            if (error) {
                console.error("Razorpay Error:", error);
                return res.status(500).json({ success: false, message: "Payment initiation failed" });
            }
            res.json({ success: true, order });
        });

    } catch (error) {
        console.error("Payment Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Verify Razorpay Payment
const verifyRazorpay = async (req, res) => {
    try {
        const { razorpay_order_id } = req.body;
        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);

        if (orderInfo.status === "paid") {
            const transactionData = await transactionModel.findById(orderInfo.receipt);
            if (!transactionData || transactionData.payment) {
                return res.status(400).json({ success: false, message: "Payment already processed or failed" });
            }

            const userData = await userModel.findById(transactionData.userId);
            if (!userData) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            const creditBalance = userData.creditBalance + transactionData.credits;
            await userModel.findByIdAndUpdate(userData._id, { creditBalance });
            await transactionModel.findByIdAndUpdate(transactionData._id, { payment: true });

            return res.json({ success: true, message: "Credits Added" });
        }

        return res.status(400).json({ success: false, message: "Payment verification failed" });

    } catch (error) {
        console.error("Payment Verification Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export { registerUser, loginUser, userCredits, paymentRazorpay, verifyRazorpay };
