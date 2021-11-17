const express = require("express");
const app = express();
const cors = require("cors");
const admin = require("firebase-admin");
const ObjectID = require("mongodb").ObjectId;
require("dotenv").config();
const { MongoClient } = require("mongodb");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET);
// firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors());
app.use(express.json());
// uri
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6mulb.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("DoctorPortal");
    const appointmentsCollection = database.collection("apoinment");
    const usersCollection = database.collection("users");

    app.get("/appointments", verifyToken, async (req, res) => {
      const cursor = appointmentsCollection.find();
      const appointments = await cursor.toArray();
      res.send(appointments);
    });
    // appoints get
    app.get("/appointments/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectID(id) };
      const cursor = await appointmentsCollection.findOne(query);
      res.send(cursor);
    });
    // // appointmenst put
    app.put("/appointments/:id", async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      console.log(payment);
      const filter = { _id: ObjectID(id) };
      const updateDoc = {
        $set: {
          payment: payment,
        },
      };
      const result = await appointmentsCollection.updateOne(filter, updateDoc);
      res.json(result);
    });
    // appointments post
    app.post("/appointments", async (req, res) => {
      const appointment = req.body;
      const result = await appointmentsCollection.insertOne(appointment);
      res.json(result);
    });
    // users get
    app.get("/users", async (req, res) => {
      const user = usersCollection.find({});
      const result = await user.toArray();
      res.send(result);
    });
    // users check admin
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });
    // users post
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      console.log(result);
      res.json(result);
    });
    // users put api
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });
    // make admin  api
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        //
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        // check admin
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res
          .status(403)
          .json({ message: "you do not have access to make admin" });
      }
    });
    //
    app.post("/create-payment-intent", async (req, res) => {
      const paymentInfo = req.body;
      const amount = paymentInfo.price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      console.log("paymentIntent", paymentIntent);
      res.json({ clientSecret: paymentIntent.client_secret });
    });
    // console
    console.log("database connect");
  } finally {
    // await client.close();
  }
}
// run function call
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Doctors portal!");
});

app.listen(port, () => {
  console.log(`listening at ${port}`);
});
