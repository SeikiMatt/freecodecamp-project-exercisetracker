import "dotenv/config";
import { dirname } from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

mongoose
  .connect(
    `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_URL}/${process.env.MONGO_DATABASE}?retryWrites=true&w=majority`
  )
  .catch((err) => console.log(err));

mongoose.connection.on("error", (err) => console.log(err));

const ExerciseSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  description: { type: String, minLength: 1, maxLenght: 20, required: true },
  duration: { type: Number, min: 1, max: 60 * 24, required: true },
  date: { type: Date, required: true },
});

const UserSchema = new mongoose.Schema({
  username: { type: String, minLength: 1, maxLength: 30, required: true },
});

const ExerciseModel = mongoose.model("Exercise", ExerciseSchema);
const UserModel = mongoose.model("User", UserSchema);

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
    res.status(500).json({ error: err });
    return;
  }
});

app.post("/api/users", async (req, res) => {
  const username = req.body.username === null ? "" : String(req.body.username);

  try {
    const newEntry = new UserModel({
      username,
    });
    const savedEntry = await newEntry.save();

    res.json({ username, _id: savedEntry._id.toString() });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err });
    return;
  }
});

app.post("/api/users/:_id/exercises", async (req, res) => {
  const reqData = {
    userId: req.params._id,
    description: req.body.description,
    duration: req.body.duration ? Number(req.body.duration) : 0,
    date: req.body.date ? new Date(req.body.date) : new Date(),
  };

  try {
    const userDoc = await UserModel.findOne({ _id: reqData.userId });
    const newExercise = new ExerciseModel(reqData);
    newExercise.save();

    res.json({
      _id: reqData.userId,
      username: userDoc.username,
      date: reqData.date.toDateString(),
      duration: reqData.duration,
      description: reqData.description,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err });
    return;
  }
});

app.get("/api/users/:_id/logs", async (req, res) => {
  const userId = req.params._id;
  const from = req.query.from
    ? new Date(req.query.from)
    : new Date("1970-01-01");
  const to = req.query.to ? new Date(req.query.to) : new Date("2099-01-01");
  const limit = Number(req.query.limit);

  try {
    const userDoc = await UserModel.findOne({ _id: userId });
    const exerciseCount = await ExerciseModel.count({ userId: userId });
    const exercises = await ExerciseModel.find(
      {
        userId: userId,
        date: {
          $gte: from,
          $lt: to,
        },
      },
      { _id: 0, description: 1, duration: 1, date: 1 }
    )
      .sort({ date: 1 })
      .limit(limit);

    const response = {
      username: userDoc.username,
      count: exerciseCount,
      _id: userId,
      log: exercises.map((entry) => {
        return {
          description: entry.description,
          duration: entry.duration,
          date: entry.date.toDateString(),
        };
      }),
    };

    if (req.query.from) response.from = from.toDateString();
    if (req.query.to) response.to = to.toDateString();

    res.json(response);
    return;
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err });
    return;
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
