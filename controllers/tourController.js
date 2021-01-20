const Tour = require('../models/tourModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
// const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

exports.aliasTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,ratingsAverage,summary,price,difficulty';
  next();
};

//ROUTE HANDLERS
//GET REQUEST(All tours)
exports.getAllTours = factory.getAll(Tour);

//GET TOUR by ID using URL Parameters
exports.getTour = factory.getOne(Tour, { path: 'reviews' });

//POST(CREATE TOUR)
exports.createTour = factory.createOne(Tour);

//PUT(UPDATE TOUR)
exports.updateTour = factory.updateOne(Tour);

//DELETE TOUR
exports.deleteTour = factory.deleteOne(Tour);

//GET TOUR STATS
exports.getTourStats = catchAsync(async (req, res, next) => {
  const stats = await Tour.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.5 } },
    },
    {
      $group: {
        _id: '$difficulty',
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        numTours: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: 1 },
    },
    // {
    //   $match: {
    //     _id: { $ne: 'easy' },
    //   },
    // },
  ]);
  res.status(200).json({
    status: 'success',
    data: {
      stats,
    },
  });
});

/*learnt how to use the unwind,match,group,sort,project,limit,addFields operators 
for sending our documents through the aggregation pipeline i.e data aggregation */
exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1;
  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates',
    },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDates' },
        numTourStarts: { $sum: 1 },
        name: { $push: '$name' },
      },
    },
    {
      $sort: { numTourStarts: -1 },
    },
    {
      $addFields: {
        month: '$_id',
      },
    },
    {
      $project: {
        _id: 0,
      },
    },
    {
      $limit: 9,
    },
  ]);
  res.status(200).json({
    status: 'success',
    data: {
      plan,
    },
  });
});

//'tours-within/:distance/center/:latlng/unit/:unit'
//tours-within/400/center/34.048338,-118.232901/unit/mi

exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  if (!lat || !lng) {
    next(
      new AppError(
        'Please Specify Latitude & Longtitude in this format lat lng',
        400
      )
    );
  }

  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  }); //find tours within radius,using co-ordinates

  res.status(200).json({
    status: 'success',
    data: {
      result: tours.length,
      data: tours,
    },
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  //tenary operator, if unit is 'mi' use first parameter, else use the other
  const multiplier = unit === 'mi' ? 0.000621371 : 0.001; 

  if (!lat || !lng) {
    next(
      new AppError(
        'Please Specify Latitude & Longtitude in this format lat lng',
        400
      )
    );
  }
  //Get the distances from the tour
  const distances = await Tour.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1],
        },
        distanceField: 'distance',
        distanceMultiplier: multiplier,
      },
    },
    {
      $project: {
        distance: 1,
        name: 1,
      },
    },
  ]);
  res.status(200).json({
    status: 'success',
    data: {
      data: distances,
    },
  });
});
