const express = require('express'); // Backend App (server)
const connection = require('./db');
const cors = require('cors'); // HTTP headers (enable requests)
const morgan = require('morgan'); // Logs incoming requests
require('dotenv').config(); // Secures content
const accountRoutes = require('./routes/account.js');
const emailRoutes = require('./routes/email.js');

// initialize app
const app = express();

// middlewares
app.use(cors('*')); // enables http requests on react development server
app.use(express.json({ limit: '10mb', extended: false })); // body parser
app.use(express.urlencoded({ limit: '1mb', extended: false })); // url parser
app.use(morgan('common')); // logs requests

//db connection
connection();

// routes
app.get('/', (request, response, next) => response.status(200).json('Gmail clone App'));
app.use('/account', accountRoutes);
app.use('/email', emailRoutes);

// server is listening for requests
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});