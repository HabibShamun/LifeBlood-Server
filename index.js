const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
require('dotenv').config();
app.use(express.json());
app.use(cors());
const port = process.env.PORT || 5000;
const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.PASS}@cluster0.0idmfrx.mongodb.net/?appName=Cluster0`;
const stripe = require('stripe')(process.env.Stripe_Secret);

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const admin = require("firebase-admin");
const serviceAccount = require("./lifeblood_adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Middleware: verify Firebase token
const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: 'unauthorized' });
  }
  try {
    const idToken = token.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
};

// Middleware: verify admin role
const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.decoded_email;
    if (!email) {
      return res.status(401).send({ message: 'Unauthorized: no email found in token' });
    }
    const user = await userCollection.findOne({ email });
    if (!user || user.role !== 'admin') {
      return res.status(403).send({ message: 'Forbidden: admin access required' });
    }
    next();
  } catch (error) {
    console.error('Error verifying admin:', error);
    res.status(500).send({ message: 'Internal server error while verifying admin' });
  }
};

async function run() {
  try {
    await client.connect();
    const db = client.db('lifeblood_db');
    const userCollection = db.collection('users');
    const donationRequestCollection = db.collection('donationRequests');
    const donationCollection = db.collection('donations');
    const bloodDonationCollection = db.collection('bloodDonation');
    const userMessagesCollection = db.collection('messages');

    // Messages route (public)
    app.post('/messages', async (req, res) => {
      const query = req.body;
      query.createdAt = new Date();
      const result = await userMessagesCollection.insertOne(query);
      res.send(result);
    });

    // User routes
    app.post('/users', async (req, res) => {
      const user = req.body;
      user.role = 'donor';
      user.status = 'active';
      user.createdAt = new Date();
      const email = user.email;
      const userExists = await userCollection.findOne({ email });
      if (userExists) {
        return res.send({ message: 'user exists' });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get('/users', verifyFBToken, async (req, res) => {
      const result = await userCollection.find({}).toArray();
      res.send(result);
    });

    app.get('/users/search', async (req, res) => {
      try {
        const { bloodType, district, upazila } = req.query;
        const query = {
          status: "active",
          role: { $in: ["donor", "volunteer"] }
        };
        if (bloodType) query.bloodType = bloodType;
        if (district) query.district = district;
        if (upazila) query.upazila = upazila;
        const result = await userCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error searching donors:", error);
        res.status(500).send({ error: "Failed to search donors" });
      }
    });

    app.get('/users/:email', verifyFBToken, async (req, res) => {
      const user = await userCollection.findOne({ email: req.params.email });
      res.send(user);
    });

    app.get('/users/:email/role', verifyFBToken, async (req, res) => {
      const user = await userCollection.findOne({ email: req.params.email });
      res.send({ role: user?.role || 'donor' });
    });

    app.patch('/users/:id/role', verifyFBToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const roleInfo = req.body;
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: roleInfo.role } }
      );
      res.send(result);
    });

    app.patch('/users/:id/status', verifyFBToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const statusInfo = req.body;
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: statusInfo.status } }
      );
      res.send(result);
    });

    // Donation request routes
    app.post('/donationRequests', verifyFBToken, async (req, res) => {
      const donationRequest = req.body;
      donationRequest.status = 'pending';
      donationRequest.createdAt = new Date();
      const result = await donationRequestCollection.insertOne(donationRequest);
      res.send(result);
    });

  app.get('/donationRequests', async (req, res) => {
  const limit = parseInt(req.query.limit) || 0; // 0 means no limit
  let cursor = donationRequestCollection.find().sort({ createdAt: -1 });
  if (limit > 0) cursor = cursor.limit(limit);
  const result = await cursor.toArray();
  res.send(result);
});


    app.get('/donationRequests/email/:email', verifyFBToken, async (req, res) => {
      const requesterEmail = req.params.email;
      const limit = parseInt(req.query.limit) || 0;
      let cursor = donationRequestCollection.find({ requesterEmail }).sort({ createdAt: -1 });
      if (limit > 0) cursor = cursor.limit(limit);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get('/donationRequests/id/:id', verifyFBToken, async (req, res) => {
      try {
        const result = await donationRequestCollection.findOne({ _id: new ObjectId(req.params.id) });
        res.send(result);
      } catch (error) {
        console.error("Error fetching donation request by ID:", error);
        res.status(500).send({ error: "Failed to fetch donation request" });
      }
    });

    app.patch('/donationRequests/:id/status', verifyFBToken, async (req, res) => {
      const result = await donationRequestCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: req.body.status } }
      );
      res.send(result);
    });

    app.patch('/donationRequests/:id', verifyFBToken, async (req, res) => {
      try {
        const id = req.params.id;
        const info = req.body;
        const updatedDoc = {
          $set: {
            recipientName: info.recipientName,
            recipientDistrict: info.recipientDistrict,
            recipientUpazila: info.recipientUpazila,
            hospitalName: info.hospitalName,
            hospitalAddress: info.hospitalAddress,
            bloodType: info.bloodType,
            donationDate: info.donationDate,
            donationTime: info.donationTime,
            donationMessage: info.donationMessage,
          },
        };
        const result = await donationRequestCollection.updateOne({ _id: new ObjectId(id) }, updatedDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating donation request:", error);
        res.status(500).send({ error: "Failed to update donation request" });
      }
    });

    app.delete('/donationRequests/:id', verifyFBToken, async (req, res) => {
      const result = await donationRequestCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    // Funding / Stripe routes
    app.post('/create-checkout-session', async (req, res) => {
      const fundingInfo = req.body;
      const amount = parseInt(fundingInfo.donatedAmount) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: 'USD',
              unit_amount: amount,
              product_data: { name: 'Donation' }
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        metadata: {
          funderEmail: fundingInfo.funderEmail,
          funderName: fundingInfo.funderName,
          amount: fundingInfo.donatedAmount
        },
              success_url: `${process.env.SITE_DOMAIN}/successfulDonation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/unsuccessful`,
      });

      res.send({ url: session.url });
    });

    app.get('/checkout-session/:id', async (req, res) => {
      try {
        const session = await stripe.checkout.sessions.retrieve(req.params.id);
        res.send(session);
      } catch (error) {
        console.error('Error retrieving session:', error);
        res.status(500).send({ error: 'Failed to retrieve session' });
      }
    });

    // Donations
    app.post('/donations', async (req, res) => {
      try {
        const donation = req.body;
        const query = { stripeSessionId: donation.stripeSessionId };
        const entryExists = await donationCollection.findOne(query);

        if (!entryExists) {
          const result = await donationCollection.insertOne(donation);
          return res.send(result);
        }

        return res.status(409).send({ message: 'Donation entry already exists' });
      } catch (error) {
        console.error('Error saving donation:', error);
        res.status(500).send({ error: 'Failed to save donation' });
      }
    });

    app.get('/donations', verifyFBToken, async (req, res) => {
      const result = await donationCollection.find().toArray();
      res.send(result);
    });

    app.get('/donations/email/:email', verifyFBToken, async (req, res) => {
      try {
        const funderEmail = req.params.email;
        const cursor = donationCollection.find({ funderEmail }).sort({ createdAt: -1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching donations by email:", error);
        res.status(500).send({ error: "Failed to fetch donations" });
      }
    });

    app.get('/donation/:id/details', verifyFBToken, async (req, res) => {
      const result = await donationCollection.findOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    app.get('/donation/total', verifyFBToken, async (req, res) => {
      try {
        const pipeline = [
          { $group: { _id: null, totalAmount: { $sum: { $toDouble: "$amount" } } } }
        ];
        const result = await donationCollection.aggregate(pipeline).toArray();
        const total = result.length > 0 ? result[0].totalAmount : 0;
        res.send({ totalAmount: total });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to calculate total donations" });
      }
    });

    // Blood donations
    app.post('/bloodDonation', verifyFBToken, async (req, res) => {
      const query = req.body;
      query.createdAt = new Date();
      const result = await bloodDonationCollection.insertOne(query);
      res.send(result);
    });

    app.get('/bloodDonation', verifyFBToken, async (req, res) => {
      const result = await bloodDonationCollection.find().toArray();
      res.send(result);
    });

    app.get('/bloodDonation/:email', verifyFBToken, async (req, res) => {
      const donorEmail = req.params.email;
      const limit = parseInt(req.query.limit) || 0;
      let cursor = bloodDonationCollection.find({ donorEmail }).sort({ createdAt: -1 });
      if (limit > 0) cursor = cursor.limit(limit);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Confirm DB connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // no cleanup needed here
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('server running');
});

app.listen(port, () => {
  console.log(`server running on port ${port}`);
});
