const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      minlength: [5, 'characters must not be less than 5'],
      maxlength: [1000, 'charcters cannot exceed 1000'],
      required: [true, 'Review cannot be empty'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    //in this case the tour and user models are the parents that reference the review model
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Tour must belong to a review'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'User must belong to a review'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

//to prevent a user making more than one review on a particular tour, create an index
reviewSchema.index({ tour: 1, user: 1 }, { unique: true }); 

//'pre' save middleware
reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name',
  });
  next();
});

//static method used to calcualte the avg rating, no. of ratings for a particular tour
reviewSchema.statics.calcRatingAvg = async function (tourId) {
  // console.log(tourId);
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
  // console.log(stats);
};

/*post middleware that makes a reference to the tourId 
wher the review was made to cal avgRating & ratingsQuantity of Tour */
reviewSchema.post('save', function () {
  //this points to the current review
  this.constructor.calcRatingAvg(this.tour);
});

reviewSchema.pre(/^findOneAnd/, async function (next) {
  this.r = await this.findOne();
  next();
});

reviewSchema.post(/^findOneAnd/, async function () {
  await this.r.constructor.calcRatingAvg(this.r.tour);
});

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
