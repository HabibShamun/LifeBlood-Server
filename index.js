const express=require('express')
const cors=require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app=express()
require('dotenv').config()
app.use(express.json())
app.use(cors())
const port=process.env.PORT||5000
const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.PASS}@cluster0.0idmfrx.mongodb.net/?appName=Cluster0`


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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db=client.db('lifeblood_db')
    const userCollection=db.collection('users')
    const donationRequestCollection=db.collection('donationRequests')
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

    app.get('/users',verifyFBToken, async(req,res)=>{
        const query={}
        const cursor= userCollection.find(query)
        const result=await cursor.toArray()
        res.send(result)
    })

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
        res.send({role:user?.role||'user'})
    })

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

    app.get('/donationRequests', async(req,res)=>{
      const cursor= donationRequestCollection.find()
      const result = await cursor.toArray()
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