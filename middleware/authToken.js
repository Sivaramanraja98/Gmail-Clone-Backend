const jwt = require('jsonwebtoken');
require('dotenv').config();

const secret = process.env.JWT_SECRET;

exports.generateToken = (id) => {
  return jwt.sign({ id }, Buffer.from(secret, 'base64'), { expiresIn: '7d' });
};

exports.authenticateToken = (request, response, next) => {
  try {
    const token = request.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, Buffer.from(secret, 'base64'));
    request.user = decoded.id;
    next();
  } catch (error) {
    console.log(error.message);
    response.status(401).json({ message: error.message });
  }
};