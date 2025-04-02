const User = require('../models/User');

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
    const { name, email, phone, profilePicture, password } = req.body;

    try {
        let user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if email is being updated and if it's already taken
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            user.email = email;
        }

        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (profilePicture) user.profilePicture = profilePicture;
        if (password) user.password = password;

        await user.save();

        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Unable to update profile' });
    }
};

module.exports = {
    getProfile,
    updateProfile,
};