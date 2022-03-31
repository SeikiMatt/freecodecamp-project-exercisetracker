import "dotenv/config";
import { dirname } from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
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
    res.status(500).json(err);
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
    res.status(500).json(err);
    return;
  }

  res.end();
  return;
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
