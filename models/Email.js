const mongoose = require('mongoose');

const instance = new mongoose.Schema(
  {
    from: {
      type: String,
      required: true,
    },
    to: String,
    subject: String,
    message: String,
  },
  {
    timestamps: true,
  },
);

const modelName = 'Email';

module.exports = mongoose.model(modelName, instance);