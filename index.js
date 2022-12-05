const express = require('express')
const cors = require('cors')
require('dotenv').config()
const jwt = require('jsonwebtoken');

const stripe = require("stripe")(process.env.STRIPE_SECRET)
const port = process.env.PORT || 5000


const app = express()


//  middlware
app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oq7uvoj.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorize acess')
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.DB_KEY, function (err, decoded) {

        if (err) {
            return res.status(401).send({ message: 'forribideen' })
        }
        req.decoded = decoded;

        next();
    })

}



function run() {
    try {
        const ApointMentCollection = client.db('appointment').collection('appointmentcollection')

        const bookingsCollection = client.db('booking').collection('bookings')

        const usersCollection = client.db('users').collection('UsersData')

        const DoctorsCollection = client.db('doctor').collection('DoctorData')

        const PaymentCollection = client.db('doctor').collection('Payment')



        const VerifyAdmin = async (req, res, next) => {

            const decodedMail = req.decoded.email
            const query = { email: decodedMail }
            const user = await usersCollection.findOne(query)
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forebiden access' })
            }
            next()
        }


        app.get('/appointment', async (req, res) => {
            const date = req.query.date;
            const query = {}
            const options = await ApointMentCollection.find(query).toArray()
            const bookingQuery = {
                selectedDate: date
            }
            const alreadyBooksItem = await bookingsCollection.find(bookingQuery).toArray()


            options.forEach(option => {

                const optionBook = alreadyBooksItem.filter(book => book.treatment === option.name)

                const BookSlots = optionBook.map(book => book.slot)

                const remainingSlotsItem = option.slots.filter(slot => !BookSlots.includes(slot))

                option.slots = remainingSlotsItem;

            })
            res.send(options)

        })

        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price

            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                'payment_method_types': [
                    "card"
                ]
            });
            res.send({
                clientSecrete: paymentIntent.client_secret

            })
        })
        app.post('/payment', async (req, res) => {
            const payment = req.body;
            const result = await PaymentCollection.insertOne(payment);
            const id = payment.bookingId;
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    paid: true,
                    tranjactionId: payment.tranjactionId
                }

            }
            const update = await bookingsCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.get('/appointments', async (req, res) => {
            const query = {}
            const result = await ApointMentCollection.find(query).project({ name: 1 }).toArray()
            res.send(result)

        })


        app.post('/doctors', async (req, res) => {
            const doctor = req.body;

            const result = await DoctorsCollection.insertOne(doctor)
            res.send(result)
        })

        app.delete('/doctors/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await DoctorsCollection.deleteOne(query)
            res.send(result)
        })


        app.get('/doctors', async (req, res) => {
            const query = {}
            const result = await DoctorsCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/booking', async (req, res) => {
            const email = req.query.email


            // const decodedmail = req.decoded.email

            // if (email !== decodedmail) {
            //     return res.status(403).send({ message: 'forribiden access' })
            // }
            const query = { email: email }

            const result = await bookingsCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/booking/:id', async (req, res) => {
            const id = req.params.id;

            const query = { _id: ObjectId(id) }
            const result = await bookingsCollection.findOne(query)
            res.send(result)


        })
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);


            if (user) {
                const token = jwt.sign({ email }, process.env.DB_KEY, { expiresIn: '30D' })
                return res.send({ accesTocken: token })
            }

            res.status(401).send({ accestokken: '' })
        })


        // all user for make admin

        app.get('/users', async (req, res) => {
            const query = {}

            const result = await usersCollection.find(query).toArray()

            res.send(result)

        })

        // check admin email
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;

            const query = { email: email }

            const user = await usersCollection.findOne(query)

            res.send({ isAdmin: user?.role === 'admin' })
        })



        // admin banano id dore
        app.put('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })
        app.get('/price', async (req, res) => {
            const filter = {}
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    price: 99
                }
            }
            const result = await ApointMentCollection.updateMany(filter, updateDoc, options)
            res.send(result)
            console.log(filter)
        })



        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user)
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })



        // modal booking data send client to database

        app.post('/booking', async (req, res) => {
            const booking = req.body;

            const query = {
                selectedDate: booking.selectedDate,
                treatment: booking.treatment,
                email: booking.email
            }
            const alreadybook = await bookingsCollection.find(query).toArray()

            if (alreadybook.length) {
                const message = `already booking on ${booking.selectedDate}`
                return res.send({ acknowledged: false, message })
            }

            const bokking = await bookingsCollection.insertOne(booking)
            res.send(bokking)

        })

        app.get('/v2/appointmentoption', async (req, res) => {
            const date = req.query.date
            const option = await ApointMentCollection.aggregate([
                {
                    $lookup: {
                        from: "bookings",
                        localField: 'name',
                        foreignField: 'treatment',
                        pipeline: [

                            {
                                $match: {
                                    $expr: {
                                        $eq: ['appointmentDate', date]
                                    }
                                }
                            }
                        ],
                        as: 'booked'
                    }
                },
                {
                    $project: {
                        name: 1,
                        price: 1,
                        slots: 1,
                        booked: {
                            $map: {
                                input: '$booked',
                                as: 'book',
                                in: '$$book.slot'
                            }
                        }
                    }
                },
                {
                    $project: {
                        name: 1,
                        price: 1,
                        slots: {
                            $setDifference: ['$slots', '$booked']
                        }
                    }

                }
            ]).toArray();
            res.send(option)
        })


    }
    finally {

    }
}
run()


app.get('/', (req, res) => {
    res.send('this api is running by hero alom')
})

app.listen(port, () => {
    console.log(`this port is running on ${port}`)
})



