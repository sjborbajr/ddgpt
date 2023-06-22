// Import required modules
import { Configuration, OpenAIApi } from "openai";
import { MongoClient, ObjectId } from 'mongodb';

const mongoUri = "mongodb://localhost/?retryWrites=true";
const client = new MongoClient(mongoUri,{ forceServerObjectId: true });
try {
  await client.connect();
} catch (error) {
  console.error('Error connecting to MongoDB:', error);
}
const database = client.db('ddgpt');
const settingsCollection = database.collection('settings'), gameDataCollection = database.collection('gameData'), responseCollection = database.collection('allResponses');
let settings = await getSetting('');

let allMessages = await gameDataCollection.find({type:'message'}).toArray();
console.log(allMessages.length);
for (let i = 0 ; i < allMessages.length; i++) {
  let created = Math.round(new Date(allMessages[i].date).getTime()/1000);
  //console.log({type:'message',_id:allMessages[i]._id},{$set:{created:created}});
  gameDataCollection.updateOne({type:'message',_id:allMessages[i]._id},{$set:{created:created}});
}

async function getSetting(setting){
  //get setting from database
  let dbsetting = await settingsCollection.findOne({});
  if (setting.length > 0) {
    dbsetting = dbsetting[setting];
  };
  return dbsetting
}
