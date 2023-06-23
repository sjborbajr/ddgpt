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
export function formatAdventureMessages(settings,allMessages,characters){
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
  for (let i = 0 ; i < allMessages.length; i++){
    if (!allMessages[i].originMessage){
      //need to adjust to only use summaries if prompt tokens are high
      if (allMessages[i].summary && settings.useSummary){
        allMessages[i].content = allMessages[i].summary;
      }
    }
    messages.push({content:allMessages[i].content,role:allMessages[i].role})
  }
  messages.push({content:assistantMessageLast.content,role:assistantMessageLast.role})
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