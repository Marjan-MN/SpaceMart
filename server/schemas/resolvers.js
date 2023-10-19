// Import Mongoose model for SpaceDebris
const { PaymentIntent, SpaceDebris, Satellite, User } = require('../models');
// Import bcrypt for password hashing
const bcrypt = require('bcrypt');
// Import jsonwebtoken for generating tokens
const jwt = require('jsonwebtoken');
const { AuthenticationError } = require('@apollo/server');
const stripe = require('stripe')('sk_test_51O1KL4FFJxtNyW2Yjpf8OcEur0Apd2VVt2rLyGOjB3WWeMbx6NgbxuOcOXJSjp83SLOmgwE6Nh6v4mxPbYMkhwJl00rbQb24O6');
const tle2czml = require('tle2czml');
const fs = require('fs');
const tempTleFilePath = 'temp.tle';
const Auth = require('../utils/auth');


const resolvers = {
    Query: {
        getTleTrajectory: async (_, { tle0, tle1, tle2 }) => {
            // Use correct line break character "\n"
            await fs.writeFileSync(tempTleFilePath, (tle0 + '\n' + tle1 + '\n' + tle2));
            const result = tle2czml.getCoords(tempTleFilePath);
            console.log(result)
            // Remove the temporary file after use
            fs.unlinkSync(tempTleFilePath);
            return { position, orientation };
        },

        getTleData: async (_, catId) => {
            //Get the TLE from the associated NORAD ID
            try {
                catId = catId.catId
                console.log(catId)
                var satData = await Satellite.find({ 'NORAD_CAT_ID': catId })
                console.log(satData[0])
                satData = satData[0]
                if (satData.length == 0) {
                    console.log('feck')
                    return {
                        NORAD_CAT_ID: catId,
                        tle0: '',
                        tle1: '',
                        tle2: ''
                    }
                }
                return {
                    NORAD_CAT_ID: catId,
                    tle0: satData.TLE_LINE0,
                    tle1: satData.TLE_LINE1,
                    tle2: satData.TLE_LINE2
                }
            }
            catch (error) {
                throw new Error(`Failed to fetch TLEData from db: ${error.message}`)
            }
        },
        getPaymentIntent: async (_, { amount, currency }) => {
            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount,
                    currency
                })
                return {
                    clientSecret: paymentIntent.client_secret
                }
            }
            catch {
                throw new Error(`Failed to create PaymentIntent: ${error.message}`)
            }
        },
        spaceDebris: async (_, { id }) => {
            try {
                return await SpaceDebris.findById(id);
            } catch (error) {
                throw new Error(`Error fetching space debris: ${error.message}`);
            }
        },
        allSpaceDebris: async () => {
            try {
                return await SpaceDebris.find();
            } catch (error) {
                throw new Error(`Error fetching space debris: ${error.message}`);
            }
        },
        satellite: async (_, { id }) => {
            try {
                return await Satellite.findById(id);
            } catch (error) {
                throw new Error(`Error fetching satellite: ${error.message}`);
            }
        },
        allSatellites: async () => {
            try {
                return await Satellite.find();
            } catch (error) {
                throw new Error(`Error fetching satellite: ${error.message}`);
            }
        },
        user: async (_, { id }) => {
            try {
                return await User.findById(id);
            } catch (error) {
                throw new Error(`Error fetching user: ${error.message}`);
            }
        },
        currentUser: async (_, __, { currentUser }) => {
            // Implement authentication logic here to check if a user is logged in
            if (!currentUser) {
                throw new Error('User not authenticated');
            }
            try {
                return await User.findById(currentUser.id);
            } catch (error) {
                throw new Error(`Error fetching current user: ${error.message}`);
            }
        },
    },

    Mutation: {

        createPaymentIntent: async (_, { input }) => {
            try {
                const newPaymentIntent = new PaymentIntent(input);
                await newPaymentIntent.save();
                return newPaymentIntent;
            } catch (error) {
                throw new Error(`Error creating PaymentIntent: ${error.message}`);
            }
        },

        createSpaceDebris: async (_, { input }) => {
            try {
                const newSpaceDebris = new SpaceDebris(input);
                await newSpaceDebris.save();
                return newSpaceDebris;
            } catch (error) {
                throw new Error(`Error creating space debris: ${error.message}`);
            }
        },
        updateSpaceDebris: async (_, { id, input }) => {
            try {
                return await SpaceDebris.findByIdAndUpdate(id, input, { new: true });
            } catch (error) {
                throw new Error(`Error updating space debris: ${error.message}`);
            }
        },
        deleteSpaceDebris: async (_, { id }) => {
            try {
                await SpaceDebris.findByIdAndDelete(id);
                return id;
            } catch (error) {
                throw new Error(`Error deleting space debris: ${error.message}`);
            }
        },
        createSatellite: async (_, { input }) => {
            try {
                const newSatellite = new Satellite(input);
                await newSatellite.save();
                return newSatellite;
            } catch (error) {
                throw new Error(`Error creating satellite: ${error.message}`);
            }
        },
        updateSatellite: async (_, { id, input }) => {
            try {
                // Find the satellite by its ID
                const satellite = await Satellite.findById(id);
                console.log(satellite)
                // Check if the satellite exists
                if (!satellite) {
                    throw new Error('Satellite not found');
                }

                // Update the owner field if it's either false or doesn't exist
                if (satellite.owner === false || satellite.owner === undefined) {
                    satellite.owner = input.ownerID;
                }

                // Save the updated satellite
                const updatedSatellite = await satellite.save();
                console.log(updatedSatellite.owner)
                return updatedSatellite;
            } catch (error) {
                throw new Error(`Error updating satellite: ${error.message}`);
            }
        },

        deleteSatellite: async (_, { id }) => {
            try {
                await Satellite.findByIdAndDelete(id);
                return id;
            } catch (error) {
                throw new Error(`Error deleting satellite: ${error.message}`);
            }
        },
        registerUser: async (_, { username, email, password }) => {
            try {
                const newUser = new User({ username, email, password });
                await newUser.save();
                const token = Auth.signToken(newUser)
                return { user: newUser, token };
            } catch (error) {
                console.log(error)
                throw new Error(`Error registering user: ${error.message}`);
            }
        },
        loginUser: async (_, { email, password }) => {
            try {
                // Implement authentication logic here (e.g., check email and password)
                const user = await User.findOne({ email });

                // Check if the user exists
                if (!user) {
                    throw new AuthenticationError('User not found');
                }

                // Compare the provided password with the hashed password in the database
                const passwordMatch = await bcrypt.compare(password, User.password);

                // If the passwords don't match, throw an AuthenticationError
                if (!passwordMatch) {
                    throw new AuthenticationError('Incorrect password');
                }
                // Generate a JWT token for the authenticated user
                const token = Auth.signToken(
                    { userId: User.id, email: User.email },
                    'your-secret-key', // Replace with a secure secret key
                    { expiresIn: '1h' } // Token expiration time
                );
                // Return the authenticated user or throw an error if authentication fails
                return {
                    token,
                    User,
                }
            } catch (error) {
                throw new Error(`Error logging in: ${error.message}`);
            }
        },
        logoutUser: async (_, __, context) => {
            try {
                // Implement logout logic here (e.g., clear authentication token)
                // Check if there's a user authenticated in the context
                if (!context.currentUser) {
                    throw new AuthenticationError('User not authenticated');
                }
                const token = Auth.signToken(
                    { userId: context.currentUser.id, email: context.currentUser.email },
                    { expiresIn: '1m' } // Token expiration time (e.g., 1 minute)
                );

                // Return true if successful, or throw an error if logout fails
                return true;
            } catch (error) {
                throw new Error(`Error logging out: ${error.message}`);
            }
        },
    },
};
module.exports = resolvers;
