//configurations for app, handles everything related to express configs
const express = require('express');

const path = require('path');

const app = express();
const morgan = require('morgan');
const rateLimiter = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRouter');
const userRouter = require('./routes/userRouter');
const reviewRouter = require('./routes/reviewRouter');
const viewRouter = require('./routes/viewRouter');

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

//MIDDLEWARES
console.log(process.env.NODE_ENV);
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); //third-party middleware for logging functionality i.e logging req status in the terminal
}

//Data Sanitization against NOSQl query injection
app.use(mongoSanitize());

//Data Sanitization against XSS attacks
app.use(xss());

//Prevent Parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'price',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
    ],
  })
);

app.use(helmet()); //setting security http headers
app.use(express.json({ limit: '10kb' })); //body-parser for telling that the incoming request body is a JSON Object
app.use(cookieParser());
//Creating our own middlewares
// app.use((req, res, next) => {
//   console.log('HELLO from the middleware');
//   next();
// });

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies);
  next();
});

//limit rate of requests coming in from a user
const limiter = rateLimiter({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests! try in an hour.',
});

app.use('/api', limiter);

//ROUTES MIDDLEWARE

app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);

//Error Handling for non-existent routes
app.all('*', (req, res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl}`, 404));
});

/*This is our global error handling middlware that comes along with express, when an err is discovered
it is sent to the the err middlware and the response is run from there */
app.use(globalErrorHandler);

module.exports = app;
