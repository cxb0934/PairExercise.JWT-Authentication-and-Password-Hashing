const Sequelize = require("sequelize");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const { STRING } = Sequelize;
const config = {
  logging: false,
};

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || "postgres://localhost/acme_db",
  config
);

const User = conn.define("user", {
  username: STRING,
  password: STRING,
});

const Note = conn.define("note", {
  text: STRING,
});

Note.belongsTo(User);
User.hasMany(Note);

const SALT_ROUNDS = 5;

// v BCRYPT ADDED
User.beforeCreate(async (user) => {
  user.password = await bcrypt.hash(user.password, SALT_ROUNDS);
});
// ^ BCRYPT ADDED

User.authenticate = async ({ username, password }) => {
  const user = await User.findOne({
    where: {
      username,
    },
  });

  // v BCRYPT ADDED
  if (user && await bcrypt.compare(password, user.password)) {
    // ^ BCRYPT ADDED

    // v JWT ADDED
    return jwt.sign({ id: user.id }, process.env.JWT);
    // ^ JWT ADDED
  }
  const error = Error("bad credentials");
  error.status = 401;
  throw error;
};

User.byToken = async (token) => {
  try {
    // v JWT ADDED
    const payload = jwt.verify(token, process.env.JWT);
    const user = await User.findByPk(payload.id);
    // ^ JWT ADDED

    if (user) {
      return user;
    }
    const error = Error("bad credentials");
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error("bad credentials");
    error.status = 401;
    throw error;
  }
};

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: "lucy", password: "lucy_pw" },
    { username: "moe", password: "moe_pw" },
    { username: "larry", password: "larry_pw" },
  ];
  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );
  const notes = [
    { text: "drink" },
    { text: "take vitamins" },
    { text: "walk dog" },
    { text: "buy orange juice" },
    { text: "call mom" },
    { text: "fill car with gas" },
  ];
  const [note1, note2, note3, note4, note5, note6] = await Promise.all(notes.map((note) => Note.create(note)));
  await lucy.setNotes([note1, note4]);
  await moe.setNotes([note2, note3]);
  await larry.setNotes([note5, note6]);

  return {
    users: {
      lucy,
      moe,
      larry,
    },
  };
};

module.exports = {
  syncAndSeed,
  models: {
    User,
  },
};
