const socket = io({autoConnect: false});

let playerName = '', currentTab = localStorage.getItem('currentTab') || 'Home', systemSettings;
if(document.getElementById(currentTab+'Btn')){
  //console.log("currentTab",currentTab);
  document.getElementById(currentTab+'Btn').click();
} else {
  //console.log("nocurrentTab");
  document.getElementById("HomeBtn").click();
}

document.getElementById('alertMsg').style.display = 'none';
document.getElementById('SystemBtn').style.display = 'none';
document.getElementById('ScotGPTBtn').style.display = 'none';
document.getElementById('HistoryBtn').style.display = 'none';
document.getElementById('character1').style.display = 'none';
document.getElementById('character2').style.display = 'none';

document.getElementById('save').addEventListener('click', save);
document.getElementById('rename').addEventListener('click', renameGptMessage);
document.getElementById('scotRun').addEventListener('click', ScotRun);
document.getElementById('replay').addEventListener('click', replay);
document.getElementById('saveChar').addEventListener('click', saveChar);
document.getElementById('connectButton').addEventListener('click', connectButton);
document.getElementById('disconnectButton').addEventListener('click', disconnectButton);
document.getElementById('adventureAction').addEventListener('click', adventureAction);
document.getElementById('player-input-edit').addEventListener('click', editAdventureInput);
document.getElementById('player-input-end').addEventListener('click', endAdventure);
document.getElementById('create-party').addEventListener('click', createParty);
document.getElementById('join-party').addEventListener('click', joinParty);

document.getElementById('history_search').addEventListener('keyup',historySearch);


// Attach event listeners to the buttons
window.onload = function() {
  //do something?
  let playerNameRead = localStorage.getItem('playerName'); // get playerName from local storage
  if (playerNameRead) {
    document.getElementById('player-name').value = playerNameRead
    connectButton();
  };
};
function showGptMessage(messageName){
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
        document.getElementById('croupier_json').value = JSON.stringify(systemSettings.messages[messageName].json,null,2);
      } else {document.getElementById('croupier_json').value = ''}
    }
  }
}
function getResponseData(listItem){
  socket.emit('fetchHistory',listItem.id);
  let table = document.getElementById('history_table');
  while(table.rows[0]) table.deleteRow(0);
  if(listItem.tagName === 'LI') {                                      // 2.
    selected= document.querySelector('li.selected');                   // 2a.
    if(selected) selected.className= '';                               // "
    listItem.className= 'selected';                                    // 2b.
  }
}
function renameGptMessage(e){
  if (document.getElementById('croupier_name_hidden').value == document.getElementById('croupier_name').value) {
    //show error alert
    alert ("old and new names are the same");
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
    document.getElementById('HistoryBtn').style.display = 'inline';
    document.getElementById('HomeBtn').style.width = '16%'
    document.getElementById('CharactersBtn').style.width = '16%'
    document.getElementById('AdventuresBtn').style.width = '17%'
    document.getElementById('SystemBtn').style.width = '17%'
    document.getElementById('HistoryBtn').style.width = '17%'
    document.getElementById('ScotGPTBtn').style.width = '17%'
  };
});
socket.on('settings', data => {
  //console.log('got game settings');
  systemSettings = data
  document.getElementById('temperature').value = data.temperature;
  document.getElementById('maxTokens').value = data.maxTokens;
  document.getElementById('model').value = data.model;
  document.getElementById('cru_temperature').value = data.cru_temperature;
  document.getElementById('cru_maxTokens').value = data.cru_maxTokens;
  document.getElementById('cru_model').value = data.cru_model;
  document.getElementById('gpt-messages-list').innerHTML = "";
  document.getElementById('forReal').checked = data.forReal;
  document.getElementById('doSummary').checked = data.doSummary;
  document.getElementById('doCroupier').checked = data.doCroupier;
  document.getElementById('useSummary').checked = data.useSummary;
  let array = []
  for (let messageName in systemSettings.messages) {
    array.push({name:messageName,section:messageName.substring(0,3),order:systemSettings.messages[messageName].order})
  }
  array.sort(function(a, b) {
    return b.section.localeCompare(a.section)
            || a.order - b.order
  })
  for(let i = 0; i < array.length; i++){
    let messageName=array[i].name;
    let entry=document.createElement('li');
    entry.onclick=function () {showGptMessage(this.innerText);};
    entry.innerText=messageName;
    document.getElementById('gpt-messages-list').appendChild(entry);
  }
  if (document.getElementById('croupier_name_hidden').value != ''){
    showGptMessage(document.getElementById('croupier_name_hidden').value);
  }
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
  //console.log('Connected to server');
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
    if(displayChar) {
      socket.emit('fetchCharData',displayChar)
    }
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
      if (data.activeAdventure) {
        document.getElementById('character_activeAdventure').value = data.activeAdventure.name;
      } else {
        document.getElementById('character_activeAdventure').value = '';
      }
      if (data.adventures) {
        document.getElementById('character_adventures').value = data.adventures[0].name;
        for (let i = 1 ; i < data.adventures.length; i++){
          document.getElementById('character_adventures').value += ','+data.adventures[i].name;
        };
      } else {
        document.getElementById('character_adventures').value = ''
      }
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
  //addAllAdventureHistory(data);
  if (data.messages) {addAllAdventureHistory(data.messages);};
  if (data.state == 'active'){
    document.getElementById('player-input-end').disabled = false;
    document.getElementById('adventureAction').disabled = false;
    document.getElementById('player-input-edit').disabled = false;
    document.getElementById('player-input-field').disabled = false;
    document.getElementById('mySidepanel-btn').hidden = false;
  } else if (data.state == 'forming') {
    document.getElementById('player-input-end').disabled = false;
    document.getElementById('adventureAction').disabled = false;
    document.getElementById('adventureAction').innerText = 'Begin';
    document.getElementById('player-input-edit').disabled = true;
    document.getElementById('player-input-field').disabled = true;
    document.getElementById('mySidepanel-btn').hidden = false;
  } else {
    document.getElementById('player-input-end').disabled = true;
    document.getElementById('adventureAction').disabled = true;
    document.getElementById('player-input-edit').disabled = true;
    document.getElementById('player-input-field').disabled = true;
    document.getElementById('mySidepanel-btn').hidden = true;
  }
});
socket.on('AllAdventurers', (data) => {
  if (localStorage.getItem('currentTab') == 'Adventures') {
    document.getElementById('mySidepanel-btn').hidden = false;
    document.getElementById('adventurers').innerHTML = "";
    for(let i = 0; i < data.length; i++){
      AddAdventurer(data[i]);
    }
  }
});
socket.on('AddAdventurer', (data) => {
  if (localStorage.getItem('currentTab') == 'Adventures') {
    for(let i = 0; i < data.length; i++){
      AddAdventurer(data[i]);
    }
  }
});
socket.on('adventureEventSuggest', (data) => {
  if (!document.getElementById('player-input-field').disabled && document.getElementById('player-input-field').value.length > 0 && data.playerName != playerName){
    document.getElementById('player-input-field').value = data.content+"\n"+document.getElementById('player-input-field').value;
  } else {
    document.getElementById('player-input-field').value = data.content;
    document.getElementById('player-input-field').disabled = true;
    document.getElementById('adventureAction').innerText = 'Approve';
    document.getElementById('player-input-edit').hidden = false;
  }
  document.getElementById("player-input-header").innerText = "Player Input - "+data.playerName;
});
socket.on('adventureEventDelete', (message_id) => {
  document.getElementById('div-'+message_id).remove();
});
socket.on('adventureEvent', (data) => {
  addAdventureHistory(data);
  document.getElementById('player-input-field').value = '';
  document.getElementById('player-input-field').disabled = false;
  document.getElementById("player-input-header").innerText = "Player Input";
  document.getElementById('adventureAction').innerText = 'Suggest';
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
      firstId = data[0]._id;
    } else if (data) {
      optionDoc.options[0] = new Option(data.name, data._id);
      firstId = data._id;
    }
    
    if (curOption == '') {
      if (firstId) {
        socket.emit('fetchAllAdventureHistory',firstId)
      }
    } else {
      document.getElementById('adventure_list').value = curOption;
      socket.emit('fetchAllAdventureHistory',curOption)
    }
  }
});
socket.on('replayRan', (response) => {
  if (localStorage.getItem('currentTab') == 'History') {
    let list = document.getElementById('gpt-history-list');
    let entry=document.createElement('li');
    entry.onclick=function () {getResponseData(this);};
    entry.innerText=response.date;
    entry.id = response._id;
    list.prepend(entry);
    getResponseData(entry);
  }
});
socket.on('historyList', (data) => {
  if (localStorage.getItem('currentTab') == 'History') {
    let list = document.getElementById('gpt-history-list');
    list.innerHTML = "";
    for(let i = 0; i < data.length; i++){
      let response=data[i];
      let entry=document.createElement('li');
      entry.onclick=function () {getResponseData(this);};
      entry.innerText=response.date;
      entry.id = response._id;
      list.appendChild(entry);
    }
  }
});
socket.on('partyForming', (data) => {
  let list = document.getElementById('starting-parties');
  let entry=document.createElement('li');
  entry.onclick=function () {partyClick(this);};
  entry.innerText=data.party_name;
  entry.id = data._id;
  entry.value = 6;
  list.appendChild(entry);
});
socket.on('formingParties', (data) => {
  if (localStorage.getItem('currentTab') == 'Home') {
    let list = document.getElementById('starting-parties');
    list.innerHTML = "";
    for(let i = 0; i < data.length; i++){
      let entry=document.createElement('li');
      entry.onclick=function () {partyClick(this);};
      entry.innerText=data[i].party_name;
      entry.id = data[i]._id;
      entry.value = 6;
      list.appendChild(entry);
    }
  }
});
socket.on('connectedPlayers', (data) => {
  if (localStorage.getItem('currentTab') == 'Home') {
    let list = document.getElementById('home-users-connected');
    list.innerHTML = "";
    for(let i = 0; i < data.length; i++){
      let user=data[i];
      let entry=document.createElement('li');
      entry.onclick=function () {playerClick(this);};
      entry.innerText=user.name;
      entry.id = user._id;
      list.appendChild(entry);
    }
  }
});
socket.on('historyData', (data) => {
  if (localStorage.getItem('currentTab') == 'History') {

    let attributes = ["model","completion_tokens","duration","finish_reason","prompt_tokens","url"];
    for (let i = 0 ; i < attributes.length; i++){
      document.getElementById('history_'+attributes[i]).value = data[attributes[i]];
    };
    document.getElementById('history_model').disabled = false;
    document.getElementById('history_status').value = data.status.toString()+':'+data.statusText;
    let request = JSON.parse(data.request);
    document.getElementById('history_temperature').value = request.temperature;
    document.getElementById('history_temperature').disabled = false;
    document.getElementById('history_maxTokens').value = request.max_tokens;
    document.getElementById('history_maxTokens').disabled = false;

    let table = document.getElementById('history_table');
    while(table.rows[0]) table.deleteRow(0);
    for (let i = 0 ; i < request.messages.length; i++){
      let newrow = document.createElement('tr');
      newrow.innerHTML = '<th onclick="swapRole(this)" style="cursor: pointer;">'+request.messages[i].role+'</th><td width="90%" ><textarea style="height:180px;">'+request.messages[i].content+'</textarea></td>';
      table.append(newrow);
    };
    let newrow = document.createElement('tr');
    newrow.innerHTML = '<th>Response</th><td width="90%"><textarea style="height:300px;" disabled>'+data.response+'</textarea></td>';
    table.append(newrow);
    newrow = document.createElement('tr');
    newrow.innerHTML = '<th>raw</th><td width="90%"><textarea style="height:500px;" disabled>'+JSON.stringify(data,null,2)+'</textarea></td>';
    table.append(newrow);
    document.getElementById('gpt-history-messages').scrollTop = document.getElementById('gpt-history-messages').scrollHeight;
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
socket.on('continueAdventure', data => {
  if (data){
    const adventureHistoryDiv = document.getElementById('adventure-history');
    let messageDiv = document.createElement('div');
    messageDiv.className = 'message dm-message loading';
    messageDiv.id = 'loading';
    messageDiv.text = 'processing'
    adventureHistoryDiv.appendChild(messageDiv);
    adventureHistoryDiv.scrollTop = adventureHistoryDiv.scrollHeight;
  } else {
    let messageDiv = document.getElementById('loading');
    if (messageDiv){
      messageDiv.remove();
    }
  }
});
socket.on('adventureEndFound', data => {
  if (data){
    const adventureEnd = document.getElementById('player-input-end');
    adventureEnd.width = adventureEnd.width*2;
    adventureEnd.height = adventureEnd.height*2;
  }
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
  //console.log('save');
  //console.log('"'+document.getElementById('croupier_content').value+'"');
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
  systemSettings.cru_temperature = document.getElementById('cru_temperature').value;
  systemSettings.cru_maxTokens = document.getElementById('cru_maxTokens').value;
  systemSettings.cru_model = document.getElementById('cru_model').value;
  systemSettings.forReal = document.getElementById('forReal').checked;
  systemSettings.doCroupier = document.getElementById('doCroupier').checked;
  systemSettings.doSummary = document.getElementById('doSummary').checked;
  systemSettings.useSummary = document.getElementById('useSummary').checked;
  socket.emit("save",systemSettings)
}
function saveChar() {
  //console.log('saveChar');
  //adventures: document.getElementById('character_adventures').value.split(","),
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
function replay() {
  let messages = [], table = document.getElementById('history_table');;
  for (var i = 0, row; row = table.rows[i]; i++) {
    if (row.cells[0].innerText == 'system' || row.cells[0].innerText == 'user' || row.cells[0].innerText == 'assistant') {
      messages.push({
        role:row.cells[0].innerText,
        content:row.cells[1].firstChild.value
      })
    } else if (row.cells[0].innerText == 'Response') {
      row.cells[1].firstChild.remove();
      row.cells[1].innerText = 'processing'
      row.cells[1].className = 'loading';
    } else {
      row.remove();
    }
  }
  let replayData = {
    temperature:document.getElementById('history_temperature').value,
    maxTokens:document.getElementById('history_maxTokens').value,
    model:document.getElementById('history_model').value,
    messages:messages
  }
  socket.emit("replay",replayData);
}
function swapRole(item) {
  if (item.innerText == 'user'){
    item.innerText = 'assistant';
  } else {
    item.innerText = 'user';
  }
}
function historyFilterLimit(filterText) {
  socket.emit('historyFilterLimit',filterText);
  socket.emit('tab','History');
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
    //console.log('connect attempt')
  } else if (document.getElementById('player-name').disabled && document.getElementById('connectButton').innerText == 'Change') {
    //console.log('enabling change name feature')
    document.getElementById('player-name').disabled = false;
    document.getElementById('connectButton').innerText = 'Suggest';
  } else {
    //console.log('requesting name change')
    socket.emit("changeName",document.getElementById('player-name').value);
  }
}
function disconnectButton() {
  socket.disconnect();
}
function historySearch(e){
  if (e.key === 'Enter' || e.keyCode === 13) {
    socket.emit("historyTextSearch",document.getElementById('history_search').value);
    socket.emit('tab','History');
  }
}
function ScotRun(){
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
function showTab(pageName,elmnt,color) {
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
  let messageDiv = document.getElementById('loading');
  if (!messageDiv){
    messageDiv = document.createElement('div');
  }
  messageDiv.className = 'message ' + (entry.role === 'user' ? 'player-message' : 'dm-message');
  messageDiv.textContent = entry.content;
  if (entry._id) {
    messageDiv.id = 'div-'+entry._id;
    let button = document.createElement('button');
    button.className = 'delete';
    button.id = entry._id;
    button.onclick = function() {
      socket.emit('deleteMessage', this.id);
    }
    button.textContent = 'x';
    messageDiv.appendChild(button);
  } else {
    messageDiv.id = '';
  }
  adventureHistoryDiv.appendChild(messageDiv);
  adventureHistoryDiv.scrollTop = adventureHistoryDiv.scrollHeight;
}
function AddAdventurer(data) {
  let list = document.getElementById('adventurers');

  let entry=document.createElement('div');
  entry.id = data.id = "div-"+data._id;
  entry.className = 'sidepanel-item'
  entry.onclick=function () {adventurerClick(this);};

    let name = document.createElement('div');
    name.innerText = "Name: " + data.name;
    entry.appendChild(name);
  
    let Class = document.createElement('div');
    Class.innerText = "Class: " + data.details.Class;
    entry.appendChild(Class);
  
    let race = document.createElement('div');
    race.innerText = "Race: " + data.details.Race;
    entry.appendChild(race);

    let table = document.createElement('table');
    table.className = "hidden-table"
    table.hidden = true;
    table.id = "hide-"+data._id;
    let tableHeaderRow = table.insertRow();
    let tableHeaderCell1 = tableHeaderRow.insertCell(), tableHeaderCell2 = tableHeaderRow.insertCell();
    tableHeaderCell1.innerText = 'Property';
    tableHeaderCell2.innerText = 'Value';
    for (var key in data.details) {
      let tableRow = table.insertRow();
      let tableCell1 = tableRow.insertCell(), tableCell2 = tableRow.insertCell();
      tableCell1.innerText = key;
      tableCell2.innerText = Array.isArray(data.details[key]) ? data.details[key].join(', ') : data.details[key];
    }
    entry.appendChild(table);

    let button = document.createElement('button');
    button.className = 'delete';
    button.id = data._id;
    button.onclick = function() {
      socket.emit('bootAdventurer', {character_id:this.id,adventure_id:document.getElementById('adventure_list').value});
      document.getElementById('div-'+this.id).remove();
    }
    button.textContent = 'x';

  entry.appendChild(button);
  list.appendChild(entry);
}
function editAdventureInput() {
  document.getElementById('player-input-field').disabled = false;
  document.getElementById('adventureAction').innerText = 'Suggest';
  document.getElementById('player-input-edit').hidden = true;
}
function endAdventure() {
  socket.emit('endAdventure',document.getElementById('adventure_list').value);
  showTab('Home',document.getElementById('HomeBtn'),'green')
}
function adventureAction() {
  if (document.getElementById('adventureAction').innerText == 'Suggest') {
    var playerInput = document.getElementById('player-input-field').value;
    socket.emit('suggestAdventureInput',{role:'user',content:playerInput,adventure_id:document.getElementById('adventure_list').value});
    document.getElementById('player-input-field').disabled = true;
    document.getElementById('player-input-edit').hidden = false;
    document.getElementById('adventureAction').innerText = 'Approve';
  } else if (document.getElementById('adventureAction').innerText == 'Approve') {
    let content = document.getElementById('player-input-field').value;
    let adventure_id = document.getElementById('adventure_list').value
    let suggestingPlayerName = document.getElementById("player-input-header").innerText
    //console.log(suggestingPlayerName)
    suggestingPlayerName = suggestingPlayerName.substring(15,suggestingPlayerName.length)

    socket.emit('approveAdventureInput',{role:'user',
                                         content:content,
                                         adventure_id:adventure_id,
                                         playerName:suggestingPlayerName
                                        });
    document.getElementById('player-input-edit').hidden = true;
  } else if (document.getElementById('adventureAction').innerText == 'Begin') {
    socket.emit('beginAdventure',document.getElementById('adventure_list').value);
  } else {
    console.log(document.getElementById('adventureAction'));
  }
}
function fetchAdventure() {
  if (document.getElementById('adventure_list').value.length == 24) {
    socket.emit('fetchAllAdventureHistory',document.getElementById('adventure_list').value)
  }
  document.getElementById('adventure-history').innerHTML = '';
}
function listAdventureOption() {
  socket.emit('listActiveAdventure',document.getElementById('active_only').checked)
  socket.emit('tab','Adventures');
  let optionDoc = document.getElementById('adventure_list');
  if (document.getElementById('active_only').checked){
    for(let i = (optionDoc.options.length - 1); i >= 0; i--) {
      optionDoc.remove(i);
    }
  }
  document.getElementById('adventure-history').innerHTML = '';
}
function adventurerClick(item){
  let div = document.getElementById('hide-'+item.id.replace("div-",""))
  if (div.hidden){
    div.hidden = false;
  } else {
    div.hidden = true;
  }
}
function playerClick(listItem){
  if(listItem.tagName === 'LI') {
    selected= document.querySelector('li.selected');
    if(selected) selected.className= '';
    listItem.className= 'selected';
  }
}
function partyClick(listItem){
  if(listItem.tagName === 'LI') {
    selected= document.querySelector('li.selected');
    if(selected) selected.className= '';
    listItem.className= 'selected party';
    listItem.tag = 'party';
  }
}
function createParty(){
  let party_name = document.getElementById('party_name').value
  socket.emit('createParty',party_name)
}
function joinParty(){
  let selected = document.querySelector('li.selected');
  if (selected){
    if (selected.value == 6){
      socket.emit('joinParty',selected.id)
    }
  }
}
function newChar() {
  let names = [{name:'Zephyr',gender:'Either'},{name:'Ember',gender:'Either'},{name:'Kairo',gender:'Either'},{name:'Vega',gender:'Either'},{name:'Astra',gender:'Female'},{name:'Riven',gender:'Either'},{name:'Azriel',gender:'Either'},{name:'Zenith',gender:'Either'},{name:'Zora',gender:'Female'},{name:'Blaze',gender:'Either'},{name:'Magna',gender:'Either'},{name:'Phoenix',gender:'Either'},{name:'Zaire',gender:'Either'},{name:'Caelum',gender:'Either'},{name:'Aegis',gender:'Either'},{name:'Valor',gender:'Either'},{name:'Zarael',gender:'Either'},{name:'Lyric',gender:'Either'},{name:'Orionis',gender:'Male'},{name:'Kael',gender:'Either'},{name:'Daxon',gender:'Male'},{name:'Zephyros',gender:'Male'},{name:'Cael',gender:'Either'},{name:'Zyra',gender:'Female'},{name:'Lyra',gender:'Female'},{name:'Nova',gender:'Female'},{name:'Selene',gender:'Female'},{name:'Zara',gender:'Female'},{name:'Nyx',gender:'Female'},{name:'Thalia',gender:'Female'},{name:'Calliope',gender:'Female'},{name:'Astrid',gender:'Female'},{name:'Lumi',gender:'Female'},{name:'Seraphina',gender:'Female'},{name:'Xyla',gender:'Female'},{name:'Zinnia',gender:'Female'},{name:'Zephyra',gender:'Female'},{name:'Nola',gender:'Female'},{name:'Aella',gender:'Female'},{name:'Zahara',gender:'Female'},{name:'Celestia',gender:'Female'},{name:'Zaria',gender:'Female'},{name:'Emberlyn',gender:'Female'},{name:'Nyssa',gender:'Female'},{name:'Zaira',gender:'Female'},{name:'Aria',gender:'Female'},{name:'Astraia',gender:'Female'},{name:'Zephyrine',gender:'Female'},{name:'Callista',gender:'Female'},{name:'Kyra',gender:'Female'},{name:'Elysia',gender:'Female'},{name:'Zariah',gender:'Female'},{name:'Astraea',gender:'Female'},{name:'Zafira',gender:'Female'},{name:'Selena',gender:'Female'},{name:'Xyliana',gender:'Female'},{name:'Orion',gender:'Male'},{name:'Xander',gender:'Male'},{name:'Ajax',gender:'Male'},{name:'Soren',gender:'Male'},{name:'Kellan',gender:'Male'},{name:'Jaxon',gender:'Male'},{name:'Daxton',gender:'Male'},{name:'Ronin',gender:'Male'},{name:'Draven',gender:'Male'},{name:'Zephyrus',gender:'Male'},{name:'Titan',gender:'Male'},{name:'Zoran',gender:'Male'},{name:'Evander',gender:'Male'},{name:'Xyler',gender:'Male'},{name:'Kian',gender:'Male'},{name:'Seraph',gender:'Male'},{name:'Ryker',gender:'Male'},{name:'Zyler',gender:'Male'},{name:'Superman',gender:'Male'},{name:'Batman',gender:'Male'},{name:'Spider-Man',gender:'Male'},{name:'Wonder Woman',gender:'Female'},{name:'Captain America',gender:'Male'},{name:'Iron Man',gender:'Male'},{name:'Thor',gender:'Male'},{name:'Hulk',gender:'Male'},{name:'Black Widow',gender:'Female'},{name:'Wolverine',gender:'Male'},{name:'Storm',gender:'Female'},{name:'Cyclops',gender:'Male'},{name:'Jean Grey',gender:'Female'},{name:'Deadpool',gender:'Male'},{name:'Aquaman',gender:'Male'},{name:'The Flash',gender:'Male'},{name:'Green Lantern',gender:'Male'},{name:'Supergirl',gender:'Female'},{name:'Nightcrawler',gender:'Male'},{name:'Black Panther',gender:'Male'},{name:'Hawkeye',gender:'Male'},{name:'Doctor Strange',gender:'Male'},{name:'Catwoman',gender:'Female'},{name:'Green Arrow',gender:'Male'},{name:'Robin',gender:'Male'},{name:'Batgirl',gender:'Female'},{name:'Rogue',gender:'Female'},{name:'Gambit',gender:'Male'},{name:'Harley Quinn',gender:'Female'},{name:'Joker',gender:'Male'},{name:'Rorschach',gender:'Male'},{name:'Spawn',gender:'Male'},{name:'Hellboy',gender:'Male'},{name:'Daredevil',gender:'Male'},{name:'Punisher',gender:'Male'},{name:'Venom',gender:'Male'},{name:'Black Canary',gender:'Female'},{name:'Luke Cage',gender:'Male'},{name:'Jessica Jones',gender:'Female'},{name:'Elektra',gender:'Female'},{name:'Green Goblin',gender:'Male'},{name:'Doctor Doom',gender:'Male'},{name:'Bane',gender:'Male'},{name:'Red Hood',gender:'Male'},{name:'Batwoman',gender:'Female'},{name:'Poison Ivy',gender:'Female'},{name:'Penguin',gender:'Male'},{name:'Black Adam',gender:'Male'},{name:'Robin Hood',gender:'Male'},{name:'Silver Surfer',gender:'Male'},{name:'Oracle',gender:'Female'},{name:'Falcon',gender:'Male'},{name:'Scarlet Witch',gender:'Female'},{name:'Vision',gender:'Male'},{name:'Black Cat',gender:'Female'},{name:'Ant-Man',gender:'Male'},{name:'Wasp',gender:'Female'},{name:'Star-Lord',gender:'Male'},{name:'Gamora',gender:'Female'},{name:'Drax the Destroyer',gender:'Male'},{name:'Rocket Raccoon',gender:'Male'},{name:'Groot',gender:'Male'},{name:'Captain Marvel',gender:'Female'},{name:'Winter Soldier',gender:'Male'},{name:'Martian Manhunter',gender:'Male'},{name:'Batwing',gender:'Male'},{name:'Hawkgirl',gender:'Female'},{name:'Zatanna',gender:'Female'},{name:'Power Girl',gender:'Female'},{name:'Firestorm',gender:'Male'},{name:'Vixen',gender:'Female'},{name:'Blue Beetle',gender:'Male'},{name:'Huntress',gender:'Female'},{name:'Nightwing',gender:'Male'},{name:'The Thing',gender:'Male'},{name:'Human Torch',gender:'Male'},{name:'Invisible Woman',gender:'Female'},{name:'Mr. Fantastic',gender:'Male'},{name:'The Hulkling',gender:'Male'},{name:'She-Hulk',gender:'Female'},{name:'Robin (Damian Wayne)',gender:'Male'},{name:'Spider-Woman',gender:'Female'},{name:'Iron Fist',gender:'Male'},{name:'Moon Knight',gender:'Male'},{name:'Shazam',gender:'Male'},{name:'Black Lightning',gender:'Male'},{name:'Ghost Rider',gender:'Male'},{name:'Batwing (Luke Fox)',gender:'Male'},{name:'Green Lantern (Jessica Cruz)',gender:'Female'},{name:'Ms. Marvel',gender:'Female'},{name:'Red Hulk',gender:'Male'},{name:'Firestar',gender:'Female'},{name:'Cable',gender:'Male'},{name:'Squirrel Girl',gender:'Female'},{name:'Silver Sable',gender:'Female'},{name:'Deathstroke',gender:'Male'},{name:'Zatara',gender:'Male'},{name:'Sinestro',gender:'Male'},{name:'Jessica Drew',gender:'Female'}];
  let Classes = ["Barbarian","Bard","Cleric","Druid","Fighter","Monk","Paladin","Ranger","Rogue","Sorcerer","Warlock","Wizard"];
  let Races = ["Dragonborn","Dwarf","Elf","Gnome","Half-Elf","Half-Orc","Halfling","Human","Tiefling"];
  let raceBonuses = {
    "Dragonborn": {"CHA": 1, "STR": 2},
    "Dwarf": {"CON": 2},
    "Elf": {"DEX": 2},
    "Gnome": {"INT": 2},
    "Half-Elf": {"CHA": 2},
    "Half-Orc": {"CON": 1, "STR": 2},
    "Halfling": {"DEX": 2},
    "Human": {"CHA": 1, "CON": 1, "DEX": 1, "INT": 1, "STR": 1, "WIS": 1},
    "Tiefling": {"CHA": 2, "INT": 1}
  };

  document.getElementById('character1').style.display = 'inline';
  document.getElementById('character2').style.display = 'inline';

  let attributes = ["HP","AC","Weapon","Armor","Class","Inventory","Backstory","activeAdventure",'adventures','id','name']
  for (let i = 0 ; i < attributes.length; i++){
    document.getElementById('character_'+attributes[i]).value = '';
  };

  //fill the drop down with potential owners
  if (document.getElementById('character_owner').options.length < 1) {
    socket.emit('listOwners');
  }
  document.getElementById('character_state').value = 'alive';
  document.getElementById('character_Lvl').value = '1';

  let selectedRace = Races[(Math.floor(Math.random() * Races.length))];
  document.getElementById('character_Race').value = selectedRace;
  document.getElementById('character_Class').value = Classes[(Math.floor(Math.random() * Classes.length))];;

  // Select a random character from the array and assign the name and gender
  let randomName = names[Math.floor(Math.random() * names.length)];
  document.getElementById('character_name').value = randomName.name;
  if (randomName.gender == 'Either'){
    let genders = ['Male','Female','not specified']
    randomName.gender = genders[Math.floor(Math.random() * genders.length)];
  }
  document.getElementById('character_Gender').value = randomName.gender;

  attributes = ["STR","DEX","CON","INT","WIS","CHA"];
  for (let i = 0 ; i < attributes.length; i++){
    document.getElementById('character_'+attributes[i]).value = rollStat();
    if (raceBonuses[selectedRace][attributes[i]]) {
      attributeValue += raceBonuses[selectedRace][attributes[i]];
    }
  };

}
function rollStat() {
  let rolls = [ Math.floor(Math.random() * 6 + 1),
                Math.floor(Math.random() * 6 + 1),
                Math.floor(Math.random() * 6 + 1),
                Math.floor(Math.random() * 6 + 1)
              ]
  rolls.sort(function(a, b){return a - b})
  return (rolls[1]+rolls[2]+rolls[3])
}
function toggleNav() {
  if (document.getElementById("mySidepanel").style.width < 1 || document.getElementById("mySidepanel").style.width == "0px") {
    document.getElementById("mySidepanel").style.width = "33%";
  } else {
    document.getElementById("mySidepanel").style.width = "0";
  }
}
