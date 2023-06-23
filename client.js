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
document.getElementById('saveChar').addEventListener('click', saveChar);
document.getElementById('connectButton').addEventListener('click', connectButton);
document.getElementById('disconnectButton').addEventListener('click', disconnectButton);
document.getElementById('adventureAction').addEventListener('click', adventureAction);
document.getElementById('player-input-edit').addEventListener('click', editAdventureInput);
document.getElementById('player-input-end').addEventListener('click', endAdventure);
document.getElementById('create-party').addEventListener('click', createParty);
document.getElementById('join-party').addEventListener('click', joinParty);

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
  //addAllAdventureHistory(data);
  if (data.messages) {addAllAdventureHistory(data.messages);};
  if (data.state == 'active'){
    document.getElementById('player-input-end').disabled = false;
    document.getElementById('adventureAction').disabled = false;
    document.getElementById('player-input-edit').disabled = false;
    document.getElementById('player-input-field').disabled = false;
  } else if (data.state == 'forming') {
    document.getElementById('player-input-end').disabled = false;
    document.getElementById('adventureAction').disabled = false;
    document.getElementById('adventureAction').innerText = 'Begin';
    document.getElementById('player-input-edit').disabled = true;
    document.getElementById('player-input-field').disabled = true;
  } else {
    document.getElementById('player-input-end').disabled = true;
    document.getElementById('adventureAction').disabled = true;
    document.getElementById('player-input-edit').disabled = true;
    document.getElementById('player-input-field').disabled = true;
  }
});
socket.on('adventureEventSuggest', (data) => {
  if (!document.getElementById('adventureAction').disabled && document.getElementById('player-input-field').value.length > 0 && data.playerName != playerName){
    document.getElementById('player-input-field').value = data.content+"\n"+document.getElementById('player-input-field').value;
  } else {
    document.getElementById('player-input-field').value = data.content;
    document.getElementById('player-input-field').disabled = true;
    document.getElementById('adventureAction').innerText = 'Approve';
    document.getElementById('player-input-edit').hidden = false;
  }
  document.getElementById("player-input-header").innerText = "Player Input - "+data.playerName;
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
    document.getElementById('history_status').value = data.status.toString()+':'+data.statusText;
    let request = JSON.parse(data.request);
    document.getElementById('history_temperature').value = request.temperature;
    document.getElementById('history_maxTokens').value = request.max_tokens;

    let table = document.getElementById('history_table');
    while(table.rows[0]) table.deleteRow(0);
    for (let i = 0 ; i < request.messages.length; i++){
      let newrow = document.createElement('tr');
      newrow.innerHTML = '<th>'+request.messages[i].role+'</th><td width="90%"><textarea class="textExpand" disabled>'+request.messages[i].content+'</textarea></td>';
      table.append(newrow);
    };
    let newrow = document.createElement('tr');
    newrow.innerHTML = '<th>Response</th><td width="90%"><textarea class="textExpand" disabled>'+data.response+'</textarea></td>';
    table.append(newrow);
    newrow = document.createElement('tr');
    newrow.innerHTML = '<th>raw</th><td width="90%"><textarea class="textExpand" disabled>'+JSON.stringify(data,null,2)+'</textarea></td>';
    table.append(newrow);
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
function ScotRun(){
  //console.log('scotRun');
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
  messageDiv.id = 'div-'+entry._id;
  messageDiv.className = 'message ' + (entry.role === 'user' ? 'player-message' : 'dm-message');
  messageDiv.textContent = entry.content;
  let button = document.createElement('button');
  button.className = 'deleteMessage';
  button.id = entry._id;
  button.onclick = function() {
    socket.emit('deleteMessage', this.id);
    document.getElementById('div-'+this.id).remove();
  }
  button.textContent = 'x';
  messageDiv.appendChild(button);
  adventureHistoryDiv.appendChild(messageDiv);
  adventureHistoryDiv.scrollTop = adventureHistoryDiv.scrollHeight;
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