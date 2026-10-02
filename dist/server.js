"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongoose_1 = __importDefault(require("mongoose"));
const app = (0, express_1.default)();
const port = Number(process.env.PORT ?? 4000);
const mongoUri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/user_management';
const jwtSecret = process.env.JWT_SECRET;
let mongoConnection = null;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!jwtSecret) {
    throw new Error('JWT_SECRET must be set in the environment.');
}
const userSchema = new mongoose_1.default.Schema({
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
}, { timestamps: true });
const User = mongoose_1.default.model('User', userSchema);
const publicUser = (user) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});
app.use((0, cors_1.default)({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express_1.default.json({ limit: '20kb' }));
app.use(async (_req, res, next) => {
    try {
        if (mongoose_1.default.connection.readyState !== 1) {
            if (mongoose_1.default.connection.readyState !== 2 || !mongoConnection) {
                mongoConnection = mongoose_1.default.connect(mongoUri).catch((error) => {
                    mongoConnection = null;
                    throw error;
                });
            }
            await mongoConnection;
        }
        next();
    }
    catch (error) {
        console.error('Unable to connect to MongoDB.', error);
        res.status(503).json({ message: 'The database is temporarily unavailable.' });
    }
});
const requireText = (value, field, maxLength = 80) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
        return `${field} is required and must be at most ${maxLength} characters.`;
    }
    return null;
};
const normalizeEmail = (value) => {
    if (typeof value !== 'string')
        return null;
    const email = value.trim().toLowerCase();
    return email.length <= 254 && emailPattern.test(email) ? email : null;
};
const handleDuplicateEmail = (error, res) => {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        res.status(409).json({ message: 'An account with this email already exists.' });
        return true;
    }
    return false;
};
const authenticate = (req, res, next) => {
    const authorization = req.header('Authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) {
        res.status(401).json({ message: 'Authentication is required.' });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, jwtSecret);
        if (typeof payload.sub !== 'string')
            throw new Error('Invalid token subject.');
        req.userId = payload.sub;
        next();
    }
    catch {
        res.status(401).json({ message: 'Your session is invalid or has expired. Please sign in again.' });
    }
};
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, password } = req.body;
    const firstNameError = requireText(firstName, 'First name');
    const lastNameError = requireText(lastName, 'Last name');
    const email = normalizeEmail(req.body.email);
    if (firstNameError || lastNameError || !email) {
        res.status(400).json({ message: firstNameError ?? lastNameError ?? 'Enter a valid email address.' });
        return;
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        res.status(400).json({ message: 'Password must be between 8 and 128 characters.' });
        return;
    }
    try {
        const existingUser = await User.exists({ email });
        if (existingUser) {
            res.status(409).json({ message: 'An account with this email already exists.' });
            return;
        }
        const user = await User.create({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email,
            password: await bcryptjs_1.default.hash(password, 12),
        });
        res.status(201).json({ message: 'Account created successfully.', user: publicUser(user) });
    }
    catch (error) {
        if (handleDuplicateEmail(error, res))
            return;
        res.status(500).json({ message: 'Unable to create the account right now.' });
    }
});
app.post('/api/login', async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    if (!email || typeof password !== 'string' || !password) {
        res.status(400).json({ message: 'Enter a valid email address and password.' });
        return;
    }
    try {
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await bcryptjs_1.default.compare(password, user.password))) {
            res.status(401).json({ message: 'Email or password is incorrect.' });
            return;
        }
        if (user.status !== 'Active') {
            res.status(403).json({ message: 'This account is inactive. Contact an administrator.' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({}, jwtSecret, { subject: user.id, expiresIn: '12h' });
        res.json({ token, user: publicUser(user) });
    }
    catch {
        res.status(500).json({ message: 'Unable to sign in right now.' });
    }
});
app.get('/api/profile', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }
        res.json({ user: publicUser(user) });
    }
    catch {
        res.status(500).json({ message: 'Unable to load your profile right now.' });
    }
});
app.get('/api/users', authenticate, async (_req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.json({ users: users.map(publicUser) });
    }
    catch {
        res.status(500).json({ message: 'Unable to load users right now.' });
    }
});
app.get('/api/users/:id', authenticate, async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id)) {
        res.status(400).json({ message: 'Invalid user ID.' });
        return;
    }
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }
        res.json({ user: publicUser(user) });
    }
    catch {
        res.status(500).json({ message: 'Unable to load this user right now.' });
    }
});
app.put('/api/users/:id', authenticate, async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id)) {
        res.status(400).json({ message: 'Invalid user ID.' });
        return;
    }
    const { firstName, lastName, status } = req.body;
    const firstNameError = requireText(firstName, 'First name');
    const lastNameError = requireText(lastName, 'Last name');
    const email = normalizeEmail(req.body.email);
    if (firstNameError || lastNameError || !email) {
        res.status(400).json({ message: firstNameError ?? lastNameError ?? 'Enter a valid email address.' });
        return;
    }
    if (status !== 'Active' && status !== 'Inactive') {
        res.status(400).json({ message: 'Status must be Active or Inactive.' });
        return;
    }
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { firstName: firstName.trim(), lastName: lastName.trim(), email, status }, { new: true, runValidators: true });
        if (!user) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }
        res.json({ message: 'User updated successfully.', user: publicUser(user) });
    }
    catch (error) {
        if (handleDuplicateEmail(error, res))
            return;
        res.status(500).json({ message: 'Unable to update this user right now.' });
    }
});
app.use((error, _req, res, _next) => {
    if (error instanceof SyntaxError) {
        res.status(400).json({ message: 'Request body must be valid JSON.' });
        return;
    }
    res.status(500).json({ message: 'An unexpected server error occurred.' });
});
if (!process.env.VERCEL) {
    mongoose_1.default.connect(mongoUri).then(() => {
        app.listen(port, () => console.log(`User API listening on http://localhost:${port}`));
    }).catch((error) => {
        console.error('Unable to start the API. Check MONGODB_URI and database availability.', error);
        process.exit(1);
    });
}
exports.default = app;
