const router = require('express').Router();
const { authenticateToken } = require('./../middleware/authToken.js');
const { registerValidations, loginValidations } = require('../middleware/validations.js');
const { register, login, getUser, updateProfilePicture } = require('../controllers/account.js');


router.post('/register', [...registerValidations], register);
router.post('/login', [...loginValidations], login);
router.get('/', authenticateToken, getUser);
router.put('/image', authenticateToken, updateProfilePicture);

module.exports = router;