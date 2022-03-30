import "dotenv/config";
import { dirname } from "path";
import { fileURLToPath } from "url";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import Joi from "joi";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

mongoose
  .connect(
    `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_URL}/${process.env.MONGO_DATABASE}?retryWrites=true&w=majority`
  )
  .catch((err) => console.log(err));

mongoose.connection.on("error", (err) => console.log(err));

function prettifyJoiError(joiError) {
  // only valid for simple schemas
  return joiError.details.length > 1
    ? joiError.details.map((entry) => entry.message)
    : joiError.details[0].message;
}

const ExerciseSchema = {
  joi: Joi.object({
    id: Joi.string().uuid().required(),
    description: Joi.string().min(1).max(20).required(),
    duration: Joi.number()
      .min(1)
      .max(60 * 24)
      .required(),
    date: Joi.date().iso().min("now"),
  }),

  mongoose: new mongoose.Schema({
    userId: { type: String, required: true },
    description: { type: String, minLength: 1, maxLenght: 20, required: true },
    duration: { type: Number, min: 1, max: 60 * 24, required: true },
    date: { type: Date, required: true },
  }),
};

const UserSchema = {
  joi: Joi.object({
    username: Joi.string().min(1).max(30).required(),
    uuid: Joi.string().uuid().required(),
  }),

  mongoose: new mongoose.Schema({
    username: { type: String, minLength: 1, maxLength: 30, required: true },
    uuid: { type: String, required: true },
    exercises: [ExerciseSchema.mongoose], // {type: ExerciseSchema.mongoose, default: () =>[{}]} ?
  }),
};

const ExerciseModel = mongoose.model("Exercise", ExerciseSchema.mongoose);
const UserModel = mongoose.model("User", UserSchema.mongoose);

// app.use(helmet());
app.use(cors());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));

app.get("/", (_, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await UserModel.find({}, { _id: 1, username: 1 });
    res.json([...users]);
    return;
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
    return;
  }
});

app.post("/api/users", async (req, res) => {
  const username = req.body.username === null ? "" : String(req.body.username); // needs proper escaping/sanitizing(?)
  const uuid = uuidv4();

  try {
    const newEntry = new UserModel({ username, _id: uuid });
    await newEntry.save();

    res.json({ username, _id: uuid });
  } catch (err) {
    res.status(500).json({
      error: "database error",
    });
    return;
  }

  res.end();
  return;
});

app.post("/api/users/:_id/exercises", async (req, res) => {
  const reqData = {
    userId: req.params._id,
    description: req.body.description,
    duration: req.body.duration ? Number(req.body.duration) : 0,
    date: req.body.date ? new Date(req.body.date) : new Date(),
  };

  try {
    const newExercise = new ExerciseModel(reqData);
    newExercise.save();

    res.json(reqData);
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
    return;
  }
});

app.get("/api/users/:_id/logs", async (req, res) => {
  console.log(req.params, req.query);
  const userId = req.params["_id"];
  const dateFrom = new Date(req.query.from);
  const dateTo = new Date(req.query.to);

  console.log(dateFrom, dateTo);

  try {
    const userDoc = await UserModel.findOne({ uuid: userId });
    const exerciseCount = await ExerciseModel.count({ userId });
    const exercises = await ExerciseModel.find(
      {
        userId,
        date: {
          $gte: dateFrom ? dateFrom : new Date("1970-01-01"),
          $lt: dateTo ? dateTo : new Date("2099-01-01"),
        },
      },
      { _id: 0, description: 1, duration: 1, date: 1 }
    )
      .sort({ date: 1 })
      .limit(req.query.limit);

    res.json({
      username: userDoc.username,
      count: exerciseCount,
      _id: userId,
      log: exercises,
    });
    return;
  } catch (err) {
    console.log(err);
    res.status(500).json({
      error: "database error",
    });
    return;
  }

  res.end();
  return;
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
