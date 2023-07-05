// Import required modules
import { Configuration, OpenAIApi } from "openai";
import { MongoClient, ObjectId } from 'mongodb';
import { encoding_for_model } from "tiktoken";
import { formatCroupierStartMessages, formatStartMessages, formatAdventureMessages, formatSummaryMessages, formatCroupierMessages } from './functions.js';

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


if (1==1){
  let response = {content:'Summary: something'}
  console.log(response);
  console.log(response.content.substring(0,8));
}

if (1==2){
  let adventure_id = new ObjectId("6495cecb002277145acc8c75");
  let allMessages = await gameDataCollection.find({type:'message',adventure_id:adventure_id}).sort({created:1}).toArray();
  let characters = await gameDataCollection.find({type:'character','activeAdventure._id':adventure_id}).toArray();
  let messages = formatAdventureMessages(settings,allMessages,characters)

  //console.log(messages);

}

if (1==2){
  let adventure_id = new ObjectId("6493886c002277145acb8d24")
  //let originMessages = await gameDataCollection.findOne({type:'message',role:'assistant',originMessage:true,adventure_id:adventure_id});
  let messages = await formatCroupierStartMessages(settings,adventure_id);
  let apiKey = settings.apiKey; //should this be by adventure?
  let croupierResponse = await openaiCall(messages,settings.cru_model,Number(settings.cru_temperature),Number(settings.cru_maxTokens),apiKey);
  console.log(croupierResponse);
  let characters = await gameDataCollection.find({type:'character','activeAdventure._id':adventure_id}).toArray();
  for (let i = 0 ; i < characters.length; i++) {
    try {
      await gameDataCollection.updateOne({_id:characters[i]._id,type:'character'},{$set:{activeAdventure:{name:responseJson.adventure_name,_id:adventure_id}},$pull:{adventures:{_id:adventure_id}}});
      await gameDataCollection.updateOne({_id:characters[i]._id,type:'character'},{$push:{adventures:{name:responseJson.adventure_name,_id:adventure_id}}});
    } catch (error) {
      console.error('Error saving croupier response to MongoDB:', error);
    }
  }
}

if (1==2){
  const enc = encoding_for_model(settings.model);

  let calls = await responseCollection.find({}).toArray()

  for (let i = 0 ; i < calls.length; i++) {
    if (calls[i].prompt_tokens) {
      try {let request=JSON.parse(calls[i].request)
        if (request){
          //let tokens2 = (enc.encode(JSON.stringify(request.messages))).length;
          let tokens = 0
          for (let j = 0 ; j < request.messages.length; j++) {
            tokens = tokens + (enc.encode(request.messages[j].content)).length + 5;
          }
          let dif=tokens - calls[i].prompt_tokens
          //let percent=Math.round(100*(1-tokens/calls[i].prompt_tokens))
          //let dif2=tokens2 - calls[i].prompt_tokens
          //let percent2=Math.round(100*(1-tokens2/calls[i].prompt_tokens))
          //console.log("actual:",calls[i].prompt_tokens, "calc whole:",tokens2,"calc parts",tokens, dif, dif2, percent,percent2,Math.round(dif/request.messages.length),Math.round(dif2/request.messages.length))
          console.log("actual:",calls[i].prompt_tokens,"calc whole:",tokens,"per message:",dif/request.messages.length)
        }
      } catch (error) {
        //console.log(error)
      }
    }
  }

}

if (1==2){
  const enc = encoding_for_model(settings.model);
  let messages = await gameDataCollection.find({type:'message','tokens.1':{$exists:true}}).toArray()
  for (let i = 0 ; i < messages.length; i++) {
    let tokens = enc.encode(messages[i].content);
    gameDataCollection.updateOne({type:'message',_id:messages[i]._id},{$set:{tokens:tokens.length}});
  }
}


if (1 == 2){
  //testing out new openai functions
  let message = await gameDataCollection.findOne({_id: new ObjectId("648a23b822b92b61b83a119c")});
  let settings = await getSetting('');
  let systemMessage = settings.messages.croupier_system2;
  let diceFunction = settings.messages.croupier_dice_function.json;

  let messages = [
    {content:systemMessage.content,role:systemMessage.role},
    {content:message.content,role:'user'}
  ];
  let functions = [
    diceFunction
  ];

  let response = ''
  if (settings.forReal){
    response = await openaiCall2(
      messages,
      functions,
      settings.cru_model,
      Number(settings.cru_temperature),
      Number(settings.cru_maxTokens),
      settings.apiKey
    );
  } else {
    response = [
      messages,
      {functions: JSON.stringify(functions,null,2)},
      settings.cru_model,
      Number(settings.cru_temperature),
      Number(settings.cru_maxTokens),
      settings.apiKey
    ];
  }

  console.log(response);

}

//let allMessages = await gameDataCollection.find({type:'message',role:'assistant'}).toArray();
//console.log(allMessages.length);
//for (let i = 0 ; i < allMessages.length; i++) {
//  //let created = Math.round(new Date(allMessages[i].date).getTime()/1000);
//  //console.log({type:'message',_id:allMessages[i]._id},{$set:{created:created}});
//  //gameDataCollection.updateOne({type:'message',_id:allMessages[i]._id},{$set:{created:created}});
//  //let allData = await responseCollection.findOne({id:allMessages[i].id})
//  //console.log(allData);
//  //gameDataCollection.updateOne({type:'message',_id:allMessages[i]._id},{$set:{tokens:allData.completion_tokens}});
//}

async function getSetting(setting){
  //get setting from database
  let dbsetting = await settingsCollection.findOne({});
  if (setting.length > 0) {
    dbsetting = dbsetting[setting];
  };
  return dbsetting
}
async function openaiCall2(messages,functions, model, temperature, maxTokens, apiKey) {
  temperature = Number(temperature);
  maxTokens = Number(maxTokens);
  try {
    let openai = new OpenAIApi(new Configuration({apiKey: apiKey}));
    const response = await openai.createChatCompletion({
      model: model,
      messages: messages,
      functions: functions,
      temperature: temperature,
      max_tokens: maxTokens
    });
    
    saveResponse(response);
    console.log(JSON.stringify(response.data.choices[0]));
    // Extract the generated response from the API
    const generatedResponse = {
      content:response.data.choices[0].message.content,
      date:response.headers.date,
      role:response.data.choices[0].message.role,
      id:response.data.id
    }
    
    return generatedResponse;
  } catch (error) {
    console.error('Error generating response from OpenAI:', error);
    let generatedResponse = '['+new Date().toUTCString()+']'
    if (error.response) {
      generatedResponse += " Status: "+error.response.status+", "+error.response.statusText;
    }
    if (error.errno) {
      generatedResponse += " errno: "+error.errno;
    }
    if (error.code) {
      generatedResponse += " code: "+error.code;
    }
    try {
      saveResponse(error.response);
    } catch (error2) {console.log(error2)}
    return {content:generatedResponse}
  }
}