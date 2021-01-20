const AppError = require('../utils/appError');

/*This is our global error handling middlware that comes along with express, when an err is discovered 
it is sent to the the err middlware and the response is run from there */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path} : ${err.value}.`;
  return new AppError(message, 400);
};

const handleDuplicateKeyDB = (err) => {
  const value = err.keyValue.name;
  const message = `You have inputed a duplicate name: ${value}, please try something unique.`;
  return new AppError(message, 400);
};

const handleValidationErr = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `invalid input data. ${errors.join('. ')}.`;
  return new AppError(message, 400);
};

const handleJwtError = () =>
  new AppError('Your token is invalid, Please login again!', 401);

const handleExpiredToken = () =>
  new AppError('Sorry, your token has expired, please login again!', 401);

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    /*this handles errors that are operational, like putting in invalid data
    operational errors are errors that aren't created by the developer*/
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    console.log('ERROR', err);

    res.status(500).json({
      status: 'Error',
      message: 'Something Went Wrong',
    });
  }
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    let error = { ...err };

    if (error.kind === 'ObjectId') error = handleCastErrorDB(error); //invalid id's
    if (error.code === 11000) error = handleDuplicateKeyDB(error); //duplicate input keys
    if (error._message === 'Validation failed')
      error = handleValidationErr(error); //validation error
    if (error.name === 'JsonWebTokenError') error = handleJwtError(); //invalid web token
    if (error.name === 'TokenExpiredError') error = handleExpiredToken(); //expired jwt
    sendErrorProd(error, res);
  }
};
