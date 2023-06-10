const socket = io({autoConnect: false});

let playerName = '', currentTab = localStorage.getItem('currentTab'), systemSettings;
if(document.getElementById(currentTab+'Btn')){
  console.log("currentTab",currentTab);
  document.getElementById(currentTab+'Btn').click();
} else {
  console.log("nocurrentTab");
  document.getElementById("HomeBtn").click();
}

document.getElementById('alertMsg').style.display = 'none';
document.getElementById('SystemBtn').style.display = 'none';
document.getElementById('ScotGPTBtn').style.display = 'none';
document.getElementById('character1').style.display = 'none';
document.getElementById('character2').style.display = 'none';

document.getElementById('save').addEventListener('click', save);
document.getElementById('rename').addEventListener('click', renameGptMessage);
document.getElementById('scotRun').addEventListener('click', ScotRun);
document.getElementById('saveChar').addEventListener('click', saveChar);
document.getElementById('connectButton').addEventListener('click', connectButton);
document.getElementById('disconnectButton').addEventListener('click', disconnectButton);
document.getElementById('player-input-submit').addEventListener('click', sendAdventureInput);
document.getElementById('player-input-edit').addEventListener('click', editAdventureInput);

// Attach event listeners to the buttons
window.onload = function() {
  //do something?
  let playerNameRead = localStorage.getItem('playerName'); // get playerName from local storage
  if (playerNameRead) {
    document.getElementById('player-name').value = playerNameRead
    connectButton();
  };
};
socket.on('settings', data => {
  console.log('got game settings');
  systemSettings = data
  document.getElementById('temperature').value = data.temperature;
  document.getElementById('maxTokens').value = data.maxTokens;
  document.getElementById('model').value = data.model;
  document.getElementById('gpt-messages-list').innerHTML = "";
  for (let messageName in systemSettings.messages) {
    let entry=document.createElement('li');
    //entry.addEventListener('onclick',showGptMessage);
    entry.onclick=function () {showGptMessage(this);};
    entry.innerText=messageName;
    document.getElementById('gpt-messages-list').appendChild(entry);
  }
});
function showGptMessage(e){
  //console.log(e);
  let messageName = e.innerText;
  if(systemSettings.messages){
    if(systemSettings.messages[messageName]) {
      //console.log(systemSettings.messages[messageName]);
      if(systemSettings.messages[messageName].role){
        document.getElementById('croupier_role').value = systemSettings.messages[messageName].role;
      } else {document.getElementById('croupier_role').value = ''}

      if(systemSettings.messages[messageName].order){
        document.getElementById('croupier_order').value = systemSettings.messages[messageName].order;
      } else {document.getElementById('croupier_order').value = ''}

      if(systemSettings.messages[messageName].content){
        document.getElementById('croupier_content').value = systemSettings.messages[messageName].content;
      } else {document.getElementById('croupier_content').value = ''}

      if(systemSettings.messages[messageName].notes){
        document.getElementById('croupier_notes').value = systemSettings.messages[messageName].notes;
      } else {document.getElementById('croupier_notes').value = ''}

      document.getElementById('croupier_name_hidden').value = messageName;
      document.getElementById('croupier_name').value = messageName;

      if(systemSettings.messages[messageName].json){
        document.getElementById('croupier_json').value = JSON.stringify(systemSettings.messages[messageName].json);
      } else {document.getElementById('croupier_json').value = ''}
    }
  }
}
function renameGptMessage(e){
  if (document.getElementById('croupier_name_hidden').value == document.getElementById('croupier_name').value) {
    //show error alert
    alert ("old and new names are the same")
  } else {
    delete systemSettings.messages[document.getElementById('croupier_name_hidden').value];
    save();
  }
}
socket.onAny((event, ...args) => {
  if (event != 'settings'){
    console.log(event, args);
  }
});
socket.on('serverRole', role => {
  if (role == 'admin') {
    document.getElementById('SystemBtn').style.display = 'inline';
    document.getElementById('ScotGPTBtn').style.display = 'inline';
    document.getElementById('HomeBtn').style.width = '20%'
    document.getElementById('CharactersBtn').style.width = '20%'
    document.getElementById('AdventuresBtn').style.width = '20%'
    document.getElementById('SystemBtn').style.width = '20%'
    document.getElementById('ScotGPTBtn').style.width = '20%'
  };
});
socket.on('error', data => {
  alert (data);
  if (data == 'user not authenticated'){
    document.getElementById('player-name').value = ''
    localStorage.removeItem('playerName');
    localStorage.removeItem('authNonce');
  }
});
socket.on('alertMsg',data => {
  document.getElementById('alertMsg').style.color = data.color;
  document.getElementById('alertMsg').innerText = data.message;
  document.getElementById('alertMsg').style.display = 'inline';
  setTimeout(()=> document.getElementById('alertMsg').style.display = 'none',data.timeout);
});
socket.on('connect', () => {
  console.log('Connected to server');
  document.getElementById('player-name').disabled = true;
  document.getElementById('disconnectButton').disabled = false;
  document.getElementById('connectButton').innerText = 'Change';
  localStorage.setItem('playerName', playerName);
  socket.emit('tab',currentTab);
  document.getElementById('alertMsg').style.color = "#4CAF50";
  document.getElementById('alertMsg').innerText = "Connected to server";
  document.getElementById('alertMsg').style.display = 'inline';
  setTimeout(()=> document.getElementById('alertMsg').style.display = 'none',1500);
});
socket.on('slap', (playerName) => {
  // are you alive message?
});
socket.on('charList', (data) => {
  let optionDoc = document.getElementById('characters_list'), curChar = document.getElementById('characters_list').value;
  if (optionDoc.options.length > 0) {
    for(let i = (optionDoc.options.length - 1); i >= 0; i--) {
      optionDoc.remove(i);
    }
  }
  let displayChar = false;
  if (data.length) {
    for(let i = 0; i < data.length; i++){
      optionDoc.options[i] = new Option(data[i].name, data[i]._id);
    }
    displayChar = data[0]._id;
  } else if (data) {
    optionDoc.options[0] = new Option(data.name, data._id);
    displayChar = data._id;
  }
  if (curChar == '') {
    document.getElementById('character1').style.display = 'none';
    document.getElementById('character2').style.display = 'none';
    socket.emit('fetchCharData',displayChar)
  } else {
    document.getElementById('characters_list').value = curChar;
    if (document.getElementById('characters_list').value != curChar){
      document.getElementById('character1').style.display = 'none';
      document.getElementById('character2').style.display = 'none';
    }
  }
});
socket.on('charData', (data) => {
  if (localStorage.getItem('currentTab') == 'Characters') {
    if (document.getElementById('characters_list').value == data._id) {
      document.getElementById('character1').style.display = 'inline';
      document.getElementById('character2').style.display = 'inline';
      document.getElementById('character_name').value = data.name;
      document.getElementById('character_id').value = data._id;
      document.getElementById('character_owner').options[0].value = data.owner_id;
      document.getElementById('character_owner').options[0].innerText = 'resolving...';
      document.getElementById('character_owner').value = data.owner_id;
      //fill the drop down with potential owners
      socket.emit('listOwners');
      document.getElementById('character_state').value = data.state;
      document.getElementById('character_activeAdventure').value = data.activeAdventure.name;
      document.getElementById('character_adventures').value = data.adventures[0].name;
      for (let i = 1 ; i < data.adventures.length; i++){
        document.getElementById('character_adventures').value += ','+data.adventures[i].name;
      };
      let attributes = ["Race","Gender","Lvl","STR","DEX","CON","INT","WIS","CHA","HP","AC","Weapon","Armor","Class","Inventory","Backstory"];
      for (let i = 0 ; i < attributes.length; i++){
        document.getElementById('character_'+attributes[i]).value = data.details[attributes[i]];
      };
    } else {
      console.log("recieved data for "+data._id+" but drop down set to "+document.getElementById('characters_list').value);
    }
  } else {
    console.log('no longer on char tab');
  }
});
socket.on('nameChanged', (name) => {
  localStorage.setItem('playerName', name);
  playerName = name
  document.getElementById('player-name').disabled = true;
  document.getElementById('player-name').value = name;
  document.getElementById('connectButton').innerText = 'Change';
});
socket.on('nonce', (nonce) => {
  localStorage.setItem('authNonce', nonce);
});
socket.on('AllAdventureHistory', (data) => {
  addAllAdventureHistory(data);
});
socket.on('adventureEventSuggest', (data) => {
  document.getElementById('player-input-field').value = data.content;
  document.getElementById('player-input-field').disabled = true;
  document.getElementById("player-input-header").innerText = "Player Input - "+data.playerName;
  document.getElementById('player-input-submit').innerText = 'Approve';
  document.getElementById('player-input-edit').hidden = false;
});
socket.on('adventureEvent', (data) => {
  addAdventureHistory(data);
  document.getElementById('player-input-field').value = '';
  document.getElementById('player-input-field').disabled = false;
  document.getElementById("player-input-header").innerText = "Player Input";
  document.getElementById('player-input-submit').innerText = 'Suggest';
  document.getElementById('player-input-edit').hidden = true;

});
socket.on('adventureList', (data) => {
  if (localStorage.getItem('currentTab') == 'Adventures') {
    let optionDoc = document.getElementById('adventure_list'), curOption = document.getElementById('adventure_list').value, firstId = false;
    if (optionDoc.options.length > 0) {
      for(let i = (optionDoc.options.length - 1); i >= 0; i--) {
        optionDoc.remove(i);
      }
    }
    if (data.length) {
      for(let i = 0; i < data.length; i++){
        optionDoc.options[i] = new Option(data[i].name, data[i]._id);
      }
      firstId = data[0]._id
    } else if (data) {
      optionDoc.options[0] = new Option(data.name, data._id);
      firstId = data._id
    }

    if (curOption == '') {
      if (firstId != '') {
        socket.emit('fetchAllAdventureHistory',firstId)
      }
    } else {
      document.getElementById('adventure_list').value = curOption;
      socket.emit('fetchAllAdventureHistory',curOption)
    }
  }
});
socket.on('listedOwners', (data) => {
  if (localStorage.getItem('currentTab') == 'Characters') {
    let optionDoc = document.getElementById('character_owner'), owner = optionDoc.options[0].value;
    if (data.length) {
      for(let i = 0; i < data.length; i++){
        optionDoc.options[i] = new Option(data[i].name, data[i]._id);
      }
      optionDoc.value = owner;
    } else if (data) {
      if (data._id == optionDoc.options[0].value){
        optionDoc.options[0].innerText = data.name
      } else {
        optionDoc.options[1] = new Option(data.name, data._id);
      }
    }
    optionDoc.disabled = false;
  } else {
    console.log("recieved owner list but no longer on char tab");
  }
});
socket.on('ScotRan', (data) => {
  document.getElementById('response-messageScot').value = data;
});
socket.on('disconnect', () => {
  console.log('Disconnected from server');
  document.getElementById('connectButton').disabled = false;
  document.getElementById('connectButton').innerText = 'Connect';
  document.getElementById('disconnectButton').disabled = true;
  document.getElementById('player-name').disabled = false;
  document.getElementById('alertMsg').style.color = "red";
  document.getElementById('alertMsg').innerText = "Disconnected from server";
  document.getElementById('alertMsg').style.display = 'inline';

});
function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}
function save() {
  console.log('save');
  console.log('"'+document.getElementById('croupier_content').value+'"');
  if (document.getElementById('croupier_name').value != '' && document.getElementById('croupier_content').value != ''){
    systemSettings.messages[document.getElementById('croupier_name').value] = {content: document.getElementById('croupier_content').value,
                                                                               role: document.getElementById('croupier_role').value
                                                                              };
    if (document.getElementById('croupier_order').value != '') {
      systemSettings.messages[document.getElementById('croupier_name').value].order = document.getElementById('croupier_order').value;
    }
    if (document.getElementById('croupier_notes').value != '') {
      systemSettings.messages[document.getElementById('croupier_name').value].notes = document.getElementById('croupier_notes').value;
    }
    if (document.getElementById('croupier_json').value != '') {
      systemSettings.messages[document.getElementById('croupier_name').value].json = JSON.parse(document.getElementById('croupier_json').value);
    }
  }
  systemSettings.temperature = document.getElementById('temperature').value;
  systemSettings.maxTokens = document.getElementById('maxTokens').value;
  systemSettings.model = document.getElementById('model').value;
  socket.emit("save",systemSettings)
}
function saveChar() {
  console.log('saveChar');
  adventures: document.getElementById('character_adventures').value.split(","),
  socket.emit("saveChar",{_id: document.getElementById('character_id').value,
                     owner_id: document.getElementById('character_owner').value,
                         data:{
                           name: document.getElementById('character_name').value,
                          state: document.getElementById('character_state').value,
                        details: {
                             Race: document.getElementById('character_Race').value,
                           Gender: document.getElementById('character_Gender').value,
                            Class: document.getElementById('character_Class').value,
                              Lvl: document.getElementById('character_Lvl').value,
                              STR: document.getElementById('character_STR').value,
                              DEX: document.getElementById('character_DEX').value,
                              CON: document.getElementById('character_CON').value,
                              INT: document.getElementById('character_INT').value,
                              WIS: document.getElementById('character_WIS').value,
                              CHA: document.getElementById('character_CHA').value,
                               HP: document.getElementById('character_HP').value,
                               AC: document.getElementById('character_AC').value,
                           Weapon: document.getElementById('character_Weapon').value.split(","),
                            Armor: document.getElementById('character_Armor').value.split(","),
                        Inventory: document.getElementById('character_Inventory').value.split(","),
                        Backstory: document.getElementById('character_Backstory').value
                                  }
                          }}
              )
}
function showCharsOption() {
  if (document.getElementById('all_characters').checked) {
    socket.emit('showCharOption','All')
    socket.emit('tab','Characters') //will refresh data
  } else {
    socket.emit('showCharOption','Own')
    socket.emit('tab','Characters') //will refresh data
  }
}
function showChar(id) {
  document.getElementById('character1').style.display = 'none';
  document.getElementById('character2').style.display = 'none';
  
  //remove all but the top owner 
  let optionDoc = document.getElementById('character_owner');
  if (optionDoc.options.length > 1) {
    for(let i = (optionDoc.options.length - 1); i >= 1; i--) {
      //optionDoc.remove(i);
    }
  }
  optionDoc.disabled = true;
  optionDoc.options[0].value = 'unowned';
  optionDoc.options[0].innerText = 'unowned';
  socket.emit('fetchCharData',id);
}
function connectButton() {
  let temp = document.getElementById('player-name').value
  document.getElementById('player-name').value = temp.trim().replace(/[^a-zA-Z0-9]/g,'');
  if (document.getElementById('player-name').value.length == 0) {
    alert('name must not be empty')
  } else if (document.getElementById('connectButton').innerText == 'Connect' && document.getElementById('player-name').value.length > 0){
    playerName = document.getElementById('player-name').value;
    let authNonce = localStorage.getItem('authNonce') || '';
    socket.auth = { playerName, authNonce };
    socket.connect();
    console.log('connect attempt')
  } else if (document.getElementById('player-name').disabled && document.getElementById('connectButton').innerText == 'Change') {
    console.log('enabling change name feature')
    document.getElementById('player-name').disabled = false;
    document.getElementById('connectButton').innerText = 'Suggest';
  } else {
    console.log('requesting name change')
    socket.emit("changeName",document.getElementById('player-name').value);
  }
}
function disconnectButton() {
  socket.disconnect();
}
function ScotRun(){
  console.log('scotRun');
  let ScotData = {
    temperature:document.getElementById('temperatureScot').value,
    apikey:document.getElementById('keyScot').value,
    maxTokens:document.getElementById('maxTokensScot').value,
    model:document.getElementById('modelScot').value,
    systemmessage:document.getElementById('system-messageScot').value,
    assistantmessage:document.getElementById('assistant-messageScot').value,
    user:document.getElementById('user-messageScot').value
  }
  socket.emit("scotRun",ScotData);
}
function saveplaying(){
  console.log('saveplaying');
  socket.emit("saveplaying",playing.checked);
}
function openPage(pageName,elmnt,color) {
  var i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName("tabcontent");
  //hide all content
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  //reset color
  tablinks = document.getElementsByClassName("tablink");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].style.backgroundColor = "";
  }
  //show the right page
  document.getElementById(pageName).style.display = "block";
  //set tab color
  elmnt.style.backgroundColor = color;
  //tell the server which tab was selected
  if (!document.getElementById('disconnectButton').disabled){
    socket.emit('tab',pageName);
  }
  //remember which tab was last
  localStorage.setItem('currentTab',pageName);
}
function addAllAdventureHistory(data) {
  const adventureHistoryDiv = document.getElementById('adventure-history');
  adventureHistoryDiv.innerHTML = '';
  data.forEach((entry) => {
    addAdventureHistory(entry);
  });
}
function addAdventureHistory(entry) {
  const adventureHistoryDiv = document.getElementById('adventure-history');
  let messageDiv = document.createElement('div');
  messageDiv.className = 'message ' + (entry.role === 'user' ? 'player-message' : 'dm-message');
  messageDiv.textContent = entry.content;
  adventureHistoryDiv.appendChild(messageDiv);
  adventureHistoryDiv.scrollTop = adventureHistoryDiv.scrollHeight;
}
function editAdventureInput() {
  document.getElementById('player-input-field').disabled = false;
  document.getElementById('player-input-submit').innerText = 'Suggest';
  document.getElementById('player-input-edit').hidden = true;
}
function sendAdventureInput() {
  if (document.getElementById('player-input-submit').innerText == 'Suggest') {
    var playerInput = document.getElementById('player-input-field').value;
    socket.emit('suggestAdventureInput',{role:'user',content:playerInput,adventure_id:document.getElementById('adventure_list').value});
    document.getElementById('player-input-field').disabled = true;
    document.getElementById('player-input-edit').hidden = false;
    document.getElementById('player-input-submit').innerText = 'Approve';
  } else {
    let content = document.getElementById('player-input-field').value;
    let adventure_id = document.getElementById('adventure_list').value
    let suggestingPlayerName = document.getElementById("player-input-header").innerText
    console.log(suggestingPlayerName)
    suggestingPlayerName = suggestingPlayerName.substring(15,suggestingPlayerName.length)

    socket.emit('approveAdventureInput',{role:'user',
                                         content:content,
                                         adventure_id:adventure_id,
                                         playerName:suggestingPlayerName
                                        });
    document.getElementById('player-input-edit').hidden = true;
  }
}
function listAdventureOption() {
  socket.emit('listActiveAdventure',document.getElementById('active_only').checked)
}