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

// const ExerciseModel = mongoose.model("Exercise", UserSchema.mongoose)
const UserModel = mongoose.model("User", UserSchema.mongoose);

// app.use(helmet());
app.use(cors());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));

app.get("/", (_, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app.post("/api/users", async (req, res) => {
  const username = req.body.username === null ? "" : String(req.body.username); // needs proper escaping/sanitizing(?)
  const uuid = uuidv4();
  const validation = UserSchema.joi.validate(
    { username, uuid },
    { abortEarly: false }
  );

  // not sure about this, still studying better ways to handle errors
  if (validation.error) {
    res.status(400).json({
      error: prettifyJoiError(validation.error),
    });
    return;
  }

  try {
    const duplicate = await UserModel.findOne({ username });

    if (duplicate !== null) {
      res.json({ username, _id: duplicate.uuid });
      return;
    }

    const newEntry = new UserModel({ username, uuid });
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
  console.log(req.body);
  const data = {
    id: req.body[":_id"] === null ? "" : String(req.body[":_id"]),
    description:
      req.body.description === null ? "" : String(req.body.description),
    duration: req.body.duration === null ? 0 : Number(req.body.duration),
    date: req.body.date === null ? "" : String(req.body.date),
  };
  const validation = ExerciseSchema.joi.validate(data, { abortEarly: false });

  if (validation.error) {
    res.status(400).json({
      error: prettifyJoiError(validation.error),
    });
    return;
  }

  try {
    const userDoc = await UserModel.findOne({ uuid: data.id });
    const newSubEntry = {
      description: data.description,
      duration: data.duration,
      date: new Date(data.date),
    };

    userDoc.exercises.push(newSubEntry);
    userDoc.save();

    res.json({
      _id: data.id,
      username: userDoc.username,
      date: new Date(data.date).toDateString(),
      duration: data.duration,
      description: data.description,
    });
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
