const express=require('express')
const cors=require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app=express()
require('dotenv').config()
app.use(express.json())
app.use(cors())
const port=process.env.PORT||5000
const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.PASS}@cluster0.0idmfrx.mongodb.net/?appName=Cluster0`
const stripe = require('stripe')(process.env.Stripe_Secret)

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


const verifyFBToken=async(req,res,next)=>{

   const token= req.headers.authorization
   if(!token) {
    return res.status(401).send({message: 'unauthorized'})
   }

   try{
        const idToken=token.split(' ')[1]
        const decoded= await admin.auth().verifyIdToken(idToken)
        req.decode_email=decoded.email
        next()
   }catch(err) {
        return res.status(401).send({message:'unauthorized access'})
   }
    
}

async function run() {
  try {
    // Connect the client to the server
    await client.connect();
    const db=client.db('lifeblood_db')
    const userCollection=db.collection('users')
    const donationRequestCollection=db.collection('donationRequests')
    const donationCollection=db.collection('donations')
    const bloodDonationCollection=db.collection('bloodDonation')
    app.post('/users', async(req,res)=>{
        const user=req.body
        user.role='donor'
        user.status='active'
        user.createdAt=new Date()

        const email=user.email
        const userExists=await userCollection.findOne({email})
        if(userExists) {
            return res.send({message: 'user exists'})
        }
        const result = await userCollection.insertOne(user)
        res.send(result)
    })

    app.get('/users', async(req,res)=>{
        const query={}
        const cursor= userCollection.find(query)
        const result=await cursor.toArray()
        res.send(result)
    })
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

       app.get('/users/:email', async(req,res)=>{
        const email=req.params.email
        const query={email}
        const user=await  userCollection.findOne(query)
        res.send(user)
    })


    app.get('/users/:email/role', async(req,res)=>{
        const email=req.params.email
        const query={email}
        const user=await  userCollection.findOne(query)
        res.send({role:user?.role||'donor'})
    })
    // Search donors (users with status active and role donor/volunteer)
// Search donors (users with status active and role donor/volunteer)





    app.patch('/users/:id/role', async(req,res)=>{
      const id=req.params.id
      const roleInfo=req.body
      const query= {_id: new ObjectId(id)}
      
      const updatedDoc={
        $set:{
          role:roleInfo.role
        }
      }
      const result=await userCollection.updateOne(query,updatedDoc)
      res.send(result)
    })

        app.patch('/users/:id/status', async(req,res)=>{
      const id=req.params.id
      const statusInfo=req.body
      const query= {_id: new ObjectId(id)}
      
      const updatedDoc={
        $set:{
          status:statusInfo.status
        }
      }
      const result=await userCollection.updateOne(query,updatedDoc)
      res.send(result)
    })



    //donation request api

    app.post('/donationRequests', async(req,res)=>{
      const donationRequest=req.body
      donationRequest.status='pending'
      donationRequest.createdAt=new Date()
      const result = await donationRequestCollection.insertOne(donationRequest)
      res.send(result) 
    })

    // Get all donation requests
app.get('/donationRequests', async (req, res) => {
  const cursor = donationRequestCollection.find().sort({createdAt:-1}).limit(3);
  const result = await cursor.toArray();
  res.send(result);
});

// Get donation requests by requester email
app.get('/donationRequests/email/:email', async (req, res) => {
  const requesterEmail = req.params.email;
  const limit = parseInt(req.query.limit) || 0; // 0 means no limit
  const query = { requesterEmail };
  let cursor = donationRequestCollection.find(query).sort({ createdAt: -1 });
  if (limit > 0) cursor = cursor.limit(limit);
  const result = await cursor.toArray();
  res.send(result);
});


// Get a single donation request by ID
app.get('/donationRequests/id/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await donationRequestCollection.findOne(query);
    res.send(result);
  } catch (error) {
    console.error("Error fetching donation request by ID:", error);
    res.status(500).send({ error: "Failed to fetch donation request" });
  }
});

    app.patch('/donationRequests/:id/status', async(req,res)=>{
  const status=req.body.status
  const id=req.params.id;
  const query= {_id:new ObjectId(id)}
  const updatedDoc={
    $set:{
      status:status
    }

  }
    const result= await donationRequestCollection.updateOne(query,updatedDoc)
    res.send(result)
})

app.patch('/donationRequests/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const info = req.body;

    const query = { _id: new ObjectId(id) };
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

    const result = await donationRequestCollection.updateOne(query, updatedDoc);
    res.send(result);
  } catch (error) {
    console.error("Error updating donation request:", error);
    res.status(500).send({ error: "Failed to update donation request" });
  }
});


app.delete('/donationRequests/:id', async(req,res)=>{
  const id=req.params.id
  const query={_id: new ObjectId(id)}
  const result= await donationRequestCollection.deleteOne(query)
  res.send(result)
})


    //funding payment related api


    app.post('/create-checkout-session',async(req,res)=>{
      const fundingInfo=req.body
      const amount=parseInt(fundingInfo.donatedAmount)*100

        const session = await stripe.checkout.sessions.create({
    line_items: [
      {
       
        price_data:{
          currency:'USD',
          unit_amount:amount,
          product_data:{
            name:'Donation'
          }
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    metadata: {
  funderEmail: fundingInfo.funderEmail,
  funderName: fundingInfo.funderName,
  amount:fundingInfo.donatedAmount
},
    success_url: `${process.env.SITE_DOMAIN}/successfulDonation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.SITE_DOMAIN}/unsuccessful`,
  });

console.log(session)
res.send({url: session.url})
    })



app.get('/checkout-session/:id', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.id);
    res.send(session);
  } catch (error) {
    console.error('Error retrieving session:', error);
    res.status(500).send({ error: 'Failed to retrieve session' });
  }
});


app.post('/donations', async (req, res) => {
  try {
    const donation = req.body;
    const query = { stripeSessionId: donation.stripeSessionId };

    const entryExists = await donationCollection.findOne(query);

    if (!entryExists) {
      const result = await donationCollection.insertOne(donation);
      return res.send(result);
    }

    return res.status(409).send({ message: 'Donation entry already exists' }); // 409 Conflict is more appropriate than 401
  } catch (error) {
    console.error('Error saving donation:', error);
    res.status(500).send({ error: 'Failed to save donation' });
  }
});

app.get('/donations', async(req,res)=>{
  const cursor =donationCollection.find()
  const result =await cursor.toArray()
  res.send(result)
})

// Total donation amount endpoint
app.get('/donation/total', async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: null,
          totalAmount: { $sum: { $toDouble: "$amount" } } // cast string → number
        }
      }
    ];

    const result = await donationCollection.aggregate(pipeline).toArray();
    const total = result.length > 0 ? result[0].totalAmount : 0;

    res.send({ totalAmount: total });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Failed to calculate total donations" });
  }
});

app.get('/donation/:id/details', async (req, res) => {
  const query = { _id: new ObjectId(req.params.id) };
  const result = await donationCollection.findOne(query);
  res.send(result);
});




//blood donations

app.post('/bloodDonation', async(req,res)=>{
  const query= req.body
  query.createdAt=new Date()
  const result= await bloodDonationCollection.insertOne(query)
  res.send(result)
})
app.get('/bloodDonation', async(req,res)=>{
  const cursor= bloodDonationCollection.find()
  const result= await cursor.toArray()
  res.send(result)
})

app.get('/bloodDonation/:email', async(req,res)=>{
  const donorEmail= req.params.email
   const limit = parseInt(req.query.limit) || 0; 
  const query={donorEmail}
  const cursor= bloodDonationCollection.find(query).sort({createdAt:-1})
  if (limit > 0) cursor = cursor.limit(limit);
  const result= await cursor.toArray()
  res.send(result)

})

    

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);

app.get('/', (req,res)=>{
    res.send('server running')
})

app.listen(port,()=>{
    console.log(`server running on port ${port}`)
})