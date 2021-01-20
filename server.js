//START SERVER
//handles everything related to the server such as database configs, defining env variables, err handling
const mongoose = require('mongoose');
const dotenv = require('dotenv');

//handle uncaught exceptions for synchronous code.
process.on('uncaughtException', (err) => {
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });
const app = require('./app');

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

// const localDB = process.env.DATABASE_LOCAL //CONNECTION FOR LOCAL DATABASE

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => {
    // console.log(con.connections)
    console.log('Connected to the Database!');
  });
// .catch((err) => {
//   console.log('Cannot connect to the database', err);
// });

// console.log(process.env);
const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
  console.log(`app running on port ${port}...`);
  // console.log(process.env)
});

/*concept of event emitters and listeners, unhandledRejection is the event being listened to in this case.
this error is only handled for asynchronous code*/
process.on('unhandledRejection', (err) => {
  server.close(() => {
    process.exit(1); //gracefully shut down the server
  });
  console.log(err.name, err.message);
});
