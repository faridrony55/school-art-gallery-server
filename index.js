const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
//const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 3000;

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  //token bearer
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

 
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.66rwgey.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try { 
    await client.connect();

    // all classes
    const classCollection = client.db("schoolartgallery").collection("artclasses");
    const userCollection = client.db("schoolartgallery").collection("users");
    const booksCollection = client.db("schoolartgallery").collection("books");
    const enrolledCollection = client.db("schoolartgallery").collection("enrolled");
    const paymentCollection = client.db("schoolartgallery").collection("paymenthistory");
    const reviewCollection = client.db("schoolartgallery").collection("review");
    

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2h' }) 
      res.send({ token })
    })


    //allclass
    app.get('/classes', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })
    //AllInstructor
    app.get('/instructor', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    //  verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }
    // verifyInstructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }
    

  // user access
  app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
    const result = await userCollection.find().toArray();
    res.send(result);
  });

  app.post("/users", async (req, res) => {
    const user = req.body;
    const query = { email: user.email };
    const existingUser = await userCollection.findOne(query);

    if (existingUser) {
      return res.send({ message: "user already exists" });
    }

    const result = await userCollection.insertOne(user);
    res.send(result);
  });


  //review
  app.post('/review', verifyJWT, async (req, res) => {
    const newItem = req.body;
    const result = await reviewCollection.insertOne(newItem)
    res.send(result);
  })
  app.get('/review', async (req, res) => {
    
    const result = await reviewCollection.find().toArray()
    res.send(result);
  })
 
 
      // admin
      app.get('/users/admin/:email', verifyJWT, async (req, res) => {
        const email = req.params.email;
  
        if (req.decoded.email !== email) {
          res.send({ admin: false })
        } 
        const query = { email: email }
        const user = await userCollection.findOne(query);
        const result = { admin: user?.role === 'admin' }
        console.log(result)
        console.log(user)
        res.send(result);
      })

  app.get('/manage-classes', verifyJWT, verifyAdmin, async (req, res) => {
    const result = await  classCollection.find().toArray();
    res.send(result);
  });
  app.patch('/manage-classes/admin/:id', async (req, res) => {
    const id = req.params.id;
    const { status } = req.body;  
  
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        status: status
      },
    };
  
    const result = await classCollection.updateOne(filter, updateDoc);
    res.send(result);
  });

  app.delete("/manage-classes/admin/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await classCollection.deleteOne(query);

    res.send(result);
  });


      // instructor
    
      app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
        const email = req.params.email;
  
        if (req.decoded.email !== email) {
          res.send({ instructor: false })
        } 
        const query = { email: email }
        const user = await userCollection.findOne(query);
        const result = { instructor: user?.role === 'instructor' }
        
        res.send(result);
      })
      app.get('/my-classes', verifyJWT, verifyInstructor, async (req, res) => {
        const result = await  classCollection.find().toArray();
        res.send(result);
      });
      app.post('/class', verifyJWT, verifyInstructor, async (req, res) => {
        const newItem = req.body;
        const result = await classCollection.insertOne(newItem)
        res.send(result);
      })
  
  

      app.delete("/users/admin/:id", async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(query);
 
        res.send(result);
      });

      app.patch('/users/admin/:id', async (req, res) => {
        const id = req.params.id;
        const { role } = req.body; // Extract the role from the request body
      
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: role
          },
        };
      
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      });
      
      


// Class Book  
app.get('/books', verifyJWT, async (req, res) => {
    const email = req.query.email; 
    if (!email) {
      res.send([]);
    } 
    const decodedEmail = req.decoded.email;
    if (email !== decodedEmail) {
      return res.status(403).send({ error: true, message: 'forbidden access' })
    } 
    const query = { email: email };
    const result = await booksCollection.find(query).toArray();
    res.send(result);
  });
   

  app.post('/books', async (req, res) => {
    const item = req.body;
    const result = await booksCollection.insertOne(item);
    res.send(result);
  })

  app.delete('/books/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await booksCollection.deleteOne(query);
    res.send(result);
  }) 


 
 

  
  app.post("/enrolled",verifyJWT, async (req, res) => {
    const payment = req.body;
    const enrolled = await enrolledCollection.insertOne(payment); 
    const paymenthistory = await paymentCollection.insertOne(payment); 

    const email = payment.email;
    const deletedClasses = await booksCollection.deleteMany({ email });
 
    const id = payment.classId;  
    const updateSeat = await classCollection.updateOne(
      { _id: new ObjectId(id) }, 
      { $inc: { seat: -1 } }  
    );
 
    res.send({enrolled,paymenthistory, deletedClasses, updateSeat }); 
    
  });
 
   

  app.get('/enrolled', verifyJWT, async (req, res) => {
    const email = req.query.email;

    const sort = { paymentDate: -1 };  
    if (!email) {
      res.send([]);
    } 
    const decodedEmail = req.decoded.email;
    if (email !== decodedEmail) {
      return res.status(403).send({ error: true, message: 'forbidden access' })
    }

    const query = { email: email };
    const result = await enrolledCollection.find(query).sort(sort).toArray();
    res.send(result);
  });

  app.delete('/enrolled/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await enrolledCollection.deleteOne(query);
    res.send(result);
  })


  app.get('/paymenthistory', verifyJWT, async (req, res) => {
    const email = req.query.email;

    const sort = { paymentDate: -1 };  
    if (!email) {
      res.send([]);
    } 
    const decodedEmail = req.decoded.email;
    if (email !== decodedEmail) {
      return res.status(403).send({ error: true, message: 'forbidden access' })
    }

    const query = { email: email };
    const result = await paymentCollection.find(query).sort(sort).toArray();
    res.send(result);
  });


  
  app.get('/viewclass/:id', verifyJWT, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
  
    try {
      const result = await enrolledCollection.findOne(query);
      res.send(result);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
 


     


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
 
app.get('/', (req, res) => {
  res.send('School Art Gallery')
})
   
app.listen(port, () => {
  console.log(`School Art Gallery on port ${port}`);
})

