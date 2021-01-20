//How we create an error, so incase an error occurs, it gets sent to the error handling mid to give out a res
class AppError extends Error {
  constructor(message, statusCode) {//constructor gets called/executed when an object is created
    super(message); //super method is for inheriting properties from the parent class i.e the Error class

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
