import { encoding_for_model } from "tiktoken";
export function CreateCharTable(characters){
  let table = 'Name      ', attributes = ["Race","Gender","Lvl","STR","DEX","CON","INT","WIS","CHA","HP","AC","Weapon","Armor","Class","Inventory","Backstory"];
  let attributesLen = [10,6,3,3,3,3,3,3,3,2,2,24,17,9,1,1], spaces = '                   ';
  for (let i = 0 ; i < attributes.length; i++){
    table+='|'+attributes[i];
    if (attributes[i].length < attributesLen[i]){
      table+=spaces.substring(0,attributesLen[i]-attributes[i].length);
    };
  };
  table+=' or Abilities'
  characters.forEach((CharData) => {
    table+='\n'+CharData.name;
    if (CharData.name.length < 10){
      table+=spaces.substring(0,10-CharData.name.length);
    }
    for (let i = 0 ; i < attributes.length; i++){
      table+='|'+CharData.details[attributes[i]];
      if ((''+CharData.details[attributes[i]]).length < attributesLen[i]){
        table+=spaces.substring(0,attributesLen[i]-(''+CharData.details[attributes[i]]).length)
      }
    };
  });
  return table;
}
export function calcTokens(messages,model){
  const enc = encoding_for_model(model);
  let adjust = 5;
  let tokens = 0;
  for (let i = 0 ; i < messages.length; i++) {
    tokens = tokens + (enc.encode(messages[i].content)).length + adjust;
  }
  enc.free();
  return tokens
}
export function getMaxTokens(model){
  let table={
    'gpt-4':8192,
    'gpt-4-0613':8192,
    'gpt-4-32k':32768,
    'gpt-4-32k-0613':32768,
    'gpt-3.5-turbo':4096,
    'gpt-3.5-turbo-16k':16384,
    'gpt-3.5-turbo-0613':4096,
    'gpt-3.5-turbo-16k-0613':16384,
    'text-davinci-003':4097,
    'text-davinci-002':4097,
    'code-davinci-002':8001
  }
  try {
    return table[model]
  } catch (error){}
}
export function formatCroupierStartMessages(settings,adventure,originMessage){
  let croupier_system = settings.messages.croupier_system;
  let croupier_assistant = settings.messages.croupier_adventure;
  let croupier_end = settings.messages.croupier_end;

  croupier_assistant.content = croupier_assistant.content.replaceAll('${json}',JSON.stringify(croupier_assistant.json));
  croupier_assistant.content = croupier_assistant.content.replaceAll('${Party_Name}',adventure.party_name);
  
  let messages = [
    {content:croupier_system.content,role:croupier_system.role},
    {content:croupier_assistant.content,role:croupier_assistant.role},
    {content:originMessage,role:'user'},
    {content:croupier_end.content,role:croupier_end.role}
  ];

  return messages
}
export function formatStartMessages(settings,characters){
  let charTable = CreateCharTable(characters);

  let dmSystemMessage = settings.messages.dm_system;
  let assistantCharTable = settings.messages.dm_char_table;
  let assistantMessageLast = settings.messages.dm_create_adventure;

  dmSystemMessage.content = dmSystemMessage.content.replaceAll('${char_count}',characters.length);
  let level = (characters.reduce((prev, curr) => prev.details.Lvl < curr.details.Lvl ? prev : curr)).details.Lvl;
  dmSystemMessage.content = dmSystemMessage.content.replaceAll('${next_level}',level);
  assistantCharTable.content = assistantCharTable.content.replaceAll('${CharTable}',charTable);

  let messages = [
    {content:dmSystemMessage.content,role:dmSystemMessage.role},
    {content:assistantCharTable.content,role:assistantCharTable.role},
    {content:assistantMessageLast.content,role:assistantMessageLast.role}
  ]
  return messages
}
export function formatAdventureMessages(settings,adventureMessages,characters){
  let charTable = CreateCharTable(characters);

  let dmSystemMessage = settings.messages.dm_system;
  let assistantCharTable = settings.messages.dm_char_table;
  let assistantMessageLast = settings.messages.dm_continue_adventure;

  dmSystemMessage.content = dmSystemMessage.content.replaceAll('${char_count}',characters.length);
  let level = (characters.reduce((prev, curr) => prev.details.Lvl < curr.details.Lvl ? prev : curr)).details.Lvl;
  dmSystemMessage.content = dmSystemMessage.content.replaceAll('${next_level}',level);
  assistantCharTable.content = assistantCharTable.content.replaceAll('${CharTable}',charTable);

  let messages = [
    {content:dmSystemMessage.content,role:dmSystemMessage.role},
    {content:assistantCharTable.content,role:assistantCharTable.role}
  ]
  for (let i = 0 ; i < adventureMessages.length; i++){
    messages.push({content:adventureMessages[i].content,role:adventureMessages[i].role})
  }
  messages.push({content:assistantMessageLast.content,role:assistantMessageLast.role})
  
  if(settings.useSummary){
    let maxTokens = getMaxTokens(settings.model);
    let trimAnyhow = 10*2
    if (maxTokens || adventureMessages.length > trimAnyhow) {
      let tokens = calcTokens(messages,settings.model)*1.01 + Number(settings.maxTokens); //max tokens in setting controls the max response tokens
      let i=1 //start on the second message because we are leaving the origin message
      //if doing summary, summarize after 10 rounds of communication
      while ((tokens > maxTokens || (adventureMessages.length - i - trimAnyhow) > 0) && i < adventureMessages.length){
        if (adventureMessages[i].tokens_savings > 4){
          messages[i+2].content = adventureMessages[i].summary;
          tokens=tokens - adventureMessages[i].tokens + adventureMessages[i].summary_tokens;
        }
        i++
      }
    }
  }
  return messages
}
export function formatSummaryMessages(settings,content){
  let croupier_system = settings.messages.croupier_system;
  let croupier_summary = settings.messages.croupier_summary;

  let messages = [
    {content:croupier_system.content,role:croupier_system.role},
    {content:croupier_summary.content,role:croupier_summary.role},
    {content:content,role:'user'}
  ];

  return messages
}
export function formatCroupierMessages(settings,content,characters){
  let croupier_system = settings.messages.croupier_system;
  let croupier_assistant = settings.messages.croupier_assistant;
  let croupier_characters = settings.messages.croupier_characters;
  let croupier_end = settings.messages.croupier_end;

  //the croupier needs to know information about the party to generate good responses
  let character_info = characters[0].name+" is a "+characters[0].details.Class
  for (let i = 1 ; i < characters.length; i++){
    character_info += '\n'+characters[i].name+" is a "+characters[i].details.Class
  }

  croupier_characters.content = croupier_characters.content.replaceAll('${char_count}',characters.length);
  croupier_characters.content = croupier_characters.content.replaceAll('${char_list}' ,character_info);
  croupier_assistant.content  = croupier_assistant.content.replaceAll('${json}'       ,JSON.stringify(croupier_assistant.json));

  let messages = [
    {content:croupier_system.content,role:croupier_system.role},
    {content:croupier_assistant.content,role:croupier_assistant.role},
    {content:croupier_characters.content,role:croupier_characters.role},
    {content:content,role:'user'},
    {content:croupier_end.content,role:croupier_end.role}
  ];

  return messages
}