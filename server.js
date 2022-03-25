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
    `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@freecodecamp.0uq3m.mongodb.net/${process.env.MONGO_DATABASE}?retryWrites=true&w=majority`
  )
  .catch((err) => console.log(err));

mongoose.connection.on("error", (err) => console.log(err));

function prettifyJoiError(joiError) {
  return joiError.details.length > 1
    ? joiError.details.map((entry) => entry.message)
    : joiError.details[0].message;
}

const UserSchema = {
  joi: Joi.object({
    username: Joi.string().min(1).max(30).required(),
    uuid: Joi.string().uuid().required(),
  }),

  mongoose: mongoose.model("User", {
    username: { type: String, minLength: 1, maxLength: 30, required: true },
    uuid: String,
  }),
};


app.use(helmet());
app.use(cors());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));

app.get("/", (_, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app.post("/api/users", async (req, res) => {
  const username = req.body.username == null ? "" : String(req.body.username); // needs proper escaping/sanitizing(?)
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
    const duplicate = await UserSchema.mongoose.findOne({ username });

    if (duplicate !== null) {
      res.json({ username, _id: duplicate.uuid });
      return;
    }

    const newEntry = new UserSchema.mongoose({ username, uuid });
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



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
