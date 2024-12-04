const socket = io({autoConnect: false});

let playerName = '', currentTab = localStorage.getItem('currentTab') || 'Home', systemSettings, settingEditCell, allRealms = ["<default>"], modelList = [ 'gpt-4' ];

document.getElementById('scotRun').addEventListener('click', ScotRun);
document.getElementById('replay').addEventListener('click', replay);
document.getElementById('saveChar').addEventListener('click', saveChar);
document.getElementById('connectButton').addEventListener('click', connectButton);
document.getElementById('disconnectButton').addEventListener('click', disconnectButton);
document.getElementById('adventureAction').addEventListener('click', adventureAction);
document.getElementById('player-input-edit').addEventListener('click', editAdventureInput);
document.getElementById('player-input-roll').addEventListener('click', AdventureInputRoll);
document.getElementById('player-input-end').addEventListener('click', endAdventure);
document.getElementById('create-party').addEventListener('click', createParty);
document.getElementById('join-party').addEventListener('click', joinParty);

document.getElementById('history_search').addEventListener('keyup',historySearch);
let basecut = .65, testers = ["Steve","Evan","Ronin"];

window.onload = function() {
  let playerNameRead = localStorage.getItem('playerName'); // get playerName from local storage
  if (playerNameRead) {
    document.getElementById('player-name').value = playerNameRead
    connectButton();
  };
  if(document.getElementById(currentTab+'Btn')){
    document.getElementById(currentTab+'Btn').click();
  } else {
    document.getElementById("HomeBtn").click();
  }
  if (localStorage.getItem('temperatureScot')){
    document.getElementById('temperatureScot').value = localStorage.getItem('temperatureScot');
  }
  if (localStorage.getItem('maxTokensScot')){
    document.getElementById('maxTokensScot').value = localStorage.getItem('maxTokensScot');
  }
  if (localStorage.getItem('modelScot')){
    document.getElementById('modelScot').value = localStorage.getItem('modelScot');
  }
};
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
    setTimeout(function() {
      document.getElementById('HomeBtn').style.width = '16%'
      document.getElementById('CharactersBtn').style.width = '16%'
      document.getElementById('AdventuresBtn').style.width = '17%'
      document.getElementById('SystemBtn').style.width = '17%'
      document.getElementById('ScotGPTBtn').style.width = '17%'
      document.getElementById('HistoryBtn').style.width = '17%'
    }, 100);
  };
});
socket.on('functionList', allFunctions => {
  let optionDoc = document.getElementById('functionList'), curOption = document.getElementById('functionList').value,firstFunction;
  while (optionDoc.length > 0) optionDoc.remove(0);
  if (allFunctions.length) {
    for(let i = 0; i < allFunctions.length; i++){
      optionDoc.options[i] = new Option(allFunctions[i], allFunctions[i]);
    }
    firstFunction = allFunctions[0];
  } else if (allFunctions) {
    optionDoc.options[0] = new Option(allFunctions, allFunctions);
    firstFunction = allFunctions;
  }
  
  if (curOption == '') {
    if (firstFunction) {
      socket.emit('fetchFunction',firstFunction);
    }
  } else {
    optionDoc.value = curOption;
    socket.emit('fetchFunction',curOption);
  }
});
socket.on('functionSettings', async functionSettings => {
  let optionDoc = document.getElementById('functionList'), table = document.getElementById('functionSettingsTable'), messageTable = document.getElementById('functionSettingsMessages')
  if (optionDoc.value = functionSettings.function){
    while (table.rows.length > 1) table.deleteRow(1);
    while (messageTable.rows.length > 1) messageTable.deleteRow(1);
    for (let property in functionSettings) {
      if (property != 'type' && property != 'messages' && property != '_id' && property != 'function') {
        let row = table.insertRow(1);
        let cell1 = row.insertCell(0), cell2 = row.insertCell(1);
        cell1.innerHTML = property;
        if (property == 'active') {
          cell2.innerHTML = functionSettings[property];
          cell2.addEventListener('click',swapTrueFalse);
        } else if (property == 'model') {
          let selectList = document.createElement("select");
          for (let i = 0; i < modelList.length; i++) {
            let option = document.createElement("option");
            option.value = modelList[i].model;
            option.text = modelList[i].model;
            selectList.appendChild(option);
          }
          selectList.value = functionSettings[property];
          cell2.appendChild(selectList)
        } else if (property == 'maxTokens' || property == 'temperature') {
          cell2.innerHTML = '<input value = "'+functionSettings[property]+'"></input>';
        } else {
          cell2.innerHTML = functionSettings[property];
          cell2.addEventListener('dblclick',editCell);
        }
      }
    }
    if (functionSettings.messages.length > 0) {
      for (let i = 0; i < functionSettings.messages.length; i++) {
        let row = messageTable.insertRow(1);
        let cell1 = row.insertCell(0), cell2 = row.insertCell(1), cell3 = row.insertCell(2), cell4 = row.insertCell(3), cell5 = row.insertCell(4), cell6 = row.insertCell(5);
        cell1.innerHTML = functionSettings.messages[i].order;
        cell1.addEventListener('dblclick',editCell);
        cell2.innerHTML = functionSettings.messages[i].role;
        cell2.addEventListener('click',swapRole);
        cell3.innerHTML = functionSettings.messages[i].content;
        cell3.addEventListener('dblclick',editCell);
        cell4.innerHTML = functionSettings.messages[i].name;
        cell4.addEventListener('dblclick',editCell);

        let selectList = document.createElement("select");
        for (let i = 0; i < allRealms.length; i++) {
          let option = document.createElement("option");
          option.value = allRealms[i];
          option.text = allRealms[i];
          selectList.appendChild(option);
        }
        let option = document.createElement("option");
        option.value = "<new>";
        option.text = "<new>";
        selectList.appendChild(option);
        selectList.addEventListener('change',realmChange)
        selectList.value = functionSettings.messages[i].realm;
        cell5.appendChild(selectList)

        if (functionSettings.messages[i].notes) cell6.innerHTML = functionSettings.messages[i].notes;
        cell6.addEventListener('dblclick',editCell);

        let button = document.createElement('button');
        button.className = 'delete2';
        button.onclick = function() {
          this.parentElement.remove();
        }
        button.textContent = 'x';
        row.append(button);
      }
      sortTable(0,'functionSettingsMessages');
    }
  }

});
socket.on('realmList', data => {
  allRealms = data;
});
socket.on('modelList', data => {
  modelList = data;
  let modelLists = document.querySelectorAll(".modelList");
  for(let i = 0; i < modelLists.length; i++) {
    let saveSelect = modelLists[i].value
    while (modelLists[i].options[0]) modelLists[i].remove(0);
    for(let j = 0; j < data.length; j++) {
      modelLists[i].options[j] = new Option(data[j].model, data[j].model);
    }
    if (modelLists[i].id == 'adventure-model') modelLists[i].options[data.length] = new Option('default', 'unset');
    if (modelLists[i].id == 'modelScot') saveSelect = localStorage.getItem('modelScot');
    modelLists[i].value = saveSelect;
  }
});
socket.on('error', data => {
  alert (data);
  if (data == 'user not authenticated'){
    document.getElementById('player-name').value = ''
    localStorage.removeItem('playerName');
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

  document.getElementById('HomeBtn').style.width = '33.3%'
  document.getElementById('AdventuresBtn').style.width = '33.3%'
  document.getElementById('CharactersBtn').style.width = '33.3%'
  document.getElementById('AdventuresBtn').style.display = 'inline';
  document.getElementById('CharactersBtn').style.display = 'inline';
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
    if(displayChar) {
      socket.emit('fetchCharData',displayChar)
    }
  } else {
    document.getElementById('characters_list').value = curChar;
  }
});
socket.on('charData', (data) => {
  if (document.getElementById('characters_list').value == data._id || data.name == document.getElementById('character_name').value) {
    document.getElementById('characters_list').value = data._id;
    if (document.getElementById('characters_list').value != data._id.toString()){
      document.getElementById('characters_list').options[document.getElementById('characters_list').options.length] = new Option(data.name, data._id);
      document.getElementById('characters_list').value = data._id;
    }
    document.getElementById('character_name').value = data.name;
    document.getElementById('character_id').value = data._id;
    if (document.getElementById('character_owner').value != data.owner_id.toString()){
      document.getElementById('character_owner').options[0].value = data.owner_id;
      document.getElementById('character_owner').options[0].innerText = 'resolving...';
      document.getElementById('character_owner').value = data.owner_id;
      //fill the drop down with potential owners
      socket.emit('listOwners');
    }
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
});
socket.on('playerName', (name) => {
  localStorage.setItem('playerName', name);
  playerName = name
  document.getElementById('player-name').disabled = true;
  document.getElementById('player-name').value = name;
  document.getElementById('connectButton').innerText = 'Change';
});
socket.on('AllAdventureHistory', (data) => {
  //addAllAdventureHistory(data);
  if (data.messages) {addAllAdventureHistory(data.messages);};
  if (data.model) {document.getElementById('adventure-model').value = data.model;} else {document.getElementById('adventure-model').value = 'unset'}
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
socket.on('AllAdventurers', (data) => {
  document.getElementById('adventurers').innerHTML = "";
  for(let i = 0; i < data.length; i++){
    AddAdventurer(data[i]);
  }
});
socket.on('AddAdventurer', (data) => {
  for(let i = 0; i < data.length; i++){
    AddAdventurer(data[i]);
  }
});
socket.on('adventureRename', (data) => {
  if (document.getElementById('adventure_list').value ==  data._id.toString()){
    document.getElementById('adventure_list').innerText = data.name;
  }
});
socket.on('RemoveAdventurer', (data) => {
  document.getElementById('div-'+data).remove();
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
});
socket.on('replayRan', (response) => {
  let list = document.getElementById('gpt-history-list');
  let entry=document.createElement('li');
  entry.onclick=function () {getResponseData(this);};
  entry.innerText=response.date;
  entry.id = response._id;
  list.prepend(entry);
  getResponseData(entry);
});
socket.on('historyList', (data) => {
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
  document.getElementById('history_search').value = document.getElementById('history_search_sent').value;
});
socket.on('partyJoined', (data) => {
  document.getElementById('adventure_list').options[0] = new Option(data.name, data._id);
  document.getElementById('adventure_list').value = data._id;
  document.getElementById('AdventuresBtn').click();
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
});
socket.on('connectedPlayers', (data) => {
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
});
socket.on('historyData', (data) => {
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
  document.getElementById('history_function').value = data.function;

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
});
socket.on('listedOwners', (data) => {
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
  //this really isn't in use
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

  document.getElementById('HomeBtn').style.width = '100%'
  document.getElementById('AdventuresBtn').style.display = 'none';
  document.getElementById('CharactersBtn').style.display = 'none';
  document.getElementById('SystemBtn').style.display = 'none';
  document.getElementById('HistoryBtn').style.display = 'none';
  document.getElementById('ScotGPTBtn').style.display = 'none';
});
function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}
function addFunction() {
  let optionDoc = document.getElementById('functionList'), table = document.getElementById('functionSettingsTable'), messageTable = document.getElementById('functionSettingsMessages')
  let newFunction = prompt("New Function", '');
  if (newFunction){
    optionDoc.options[optionDoc.options.length] = new Option(newFunction, newFunction);
    optionDoc.value = newFunction
    while (table.rows.length > 1) table.deleteRow(1);
    while (messageTable.rows.length > 1) messageTable.deleteRow(1);
  }
}
function addFunctionSettings() {
  let table = document.getElementById('functionSettingsTable')
  let newSetting = prompt("New Setting Name", '');
  if (newSetting){
    let row = table.insertRow(table.rows.length);
    let cell1 = row.insertCell(0), cell2 = row.insertCell(1);
    cell1.innerHTML = newSetting;
    cell2.addEventListener('dblclick',editCell);
  }
}
function realmChange(event) {
  if (event.target.value == '<new>') {
    let newRealm = prompt("New Realm", '');
    if (newRealm) {
      newRealm = newRealm.trim().replace(/[^a-zA-Z0-9 &-]/g,'');
      event.target.options[event.target.options.length] = new Option(newRealm, newRealm);
      event.target.value = newRealm;
      socket.to('Tab-System').emit( 'addRealm',  newRealm);
    } else {
      event.target.value = '<default>'
    }
  }
}
function addFunctionSettingsMessages() {
  let messageTable = document.getElementById('functionSettingsMessages')
  let row = messageTable.insertRow(messageTable.rows.length);
  let cell1 = row.insertCell(0), cell2 = row.insertCell(1), cell3 = row.insertCell(2), cell4 = row.insertCell(3), cell5 = row.insertCell(4), cell6 = row.insertCell(5);
  cell1.addEventListener('dblclick',editCell);
  cell2.addEventListener('click',swapRole);
  cell3.addEventListener('dblclick',editCell);
  cell4.addEventListener('dblclick',editCell);

  let selectList = document.createElement("select");
  for (let i = 0; i < allRealms.length; i++) {
    let option = document.createElement("option");
    option.value = allRealms[i];
    option.text = allRealms[i];
    selectList.appendChild(option);
  }
  let option = document.createElement("option");
  option.value = "<new>";
  option.text = "<new>";
  selectList.appendChild(option);
  selectList.value = "<default>";
  cell5.appendChild(selectList)

  cell6.addEventListener('dblclick',editCell);
}
function saveEdit() {
  let editField = document.getElementById("editField");
  settingEditCell.textContent = editField.value;
  settingEditCell = null;
  editBox.style.display = "none";
}
function cancelEdit() {
  settingEditInfo = null;
  editBox.style.display = "none";
}
function editCell(event) {
  settingEditCell = event.target;
  let editField = document.getElementById("editField");
  editField.value = settingEditCell.textContent;
  editBox.style.display = "block";
  editField.focus();
}
function saveSettings() {
  let userConfirmed = window.confirm("Are you sure you want to save this function?");
  if (userConfirmed) {
    // User clicked OK, perform the delete action
    let optionDoc = document.getElementById('functionList'), table = document.getElementById('functionSettingsTable'), messageTable = document.getElementById('functionSettingsMessages')
    let functionSettings = {function:optionDoc.value}
    for (var i = 1, row; row = table.rows[i]; i++) {
      if (row.cells[1].firstChild.value) {
        functionSettings[row.cells[0].innerHTML] = row.cells[1].firstChild.value;
      } else {
        functionSettings[row.cells[0].innerHTML] = row.cells[1].innerHTML;
      }
    }
    let messages = []
    for (var i = 1, row; row = messageTable.rows[i]; i++) {
      let message = {type:"message",function:optionDoc.value}
      if (row.cells[0].innerHTML) message.order = row.cells[0].innerHTML
      if (row.cells[1].innerHTML) message.role = row.cells[1].innerHTML
      if (row.cells[2].innerHTML) message.content = row.cells[2].innerHTML
      if (row.cells[3].innerHTML) message.name = row.cells[3].innerHTML
      if (row.cells[4].innerHTML) message.realm = row.cells[4].firstChild.value
      if (row.cells[5].innerHTML) message.notes = row.cells[5].innerHTML
      messages.push(message)
    }
    functionSettings.messages = messages;
    socket.emit('saveSettings',functionSettings);
  }
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
  //remove all but the top owner 
  let optionDoc = document.getElementById('character_owner');
  if (optionDoc.options.length > 1) {
    for(let i = (optionDoc.options.length - 1); i >= 1; i--) {
      //optionDoc.remove(i);
    }
  }
  optionDoc.options[0].value = 'resolving';
  optionDoc.options[0].innerText = 'resolving';
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
function historyDelete(){
  let li = document.querySelector('li.selected')
  socket.emit('historyDelete',li.id)
  li.remove()
  let table = document.getElementById('history_table');
  while(table.rows[0]) table.deleteRow(0);
}
function replayAdd(){
  let table = document.getElementById('history_table');
  if (table.rows[table.rows.length-1].cells[0].innerHTML == 'raw') table.rows[table.rows.length-1].remove()
  if (table.rows[table.rows.length-1].cells[0].innerHTML == 'Response') {
    table.rows[table.rows.length-1].cells[0].innerHTML = 'assistant'
    table.rows[table.rows.length-1].cells[0].addEventListener('click', swapRole);
    table.rows[table.rows.length-1].cells[0].style="cursor: pointer;"
    table.rows[table.rows.length-1].cells[1].firstChild.removeAttribute("disabled")
  }
  let newrow = document.createElement('tr');
  newrow.innerHTML = '<th onclick="swapRole(this)" style="cursor: pointer;">user</th><td><textarea oninput="autoResize(this)"></textarea></td>';
  table.append(newrow);
}
function replayRemove(){
  let table = document.getElementById('history_table');
  if (table.rows[table.rows.length-1].cells[0].innerHTML == 'raw') table.rows[table.rows.length-1].remove()
  if (table.rows[table.rows.length-1].cells[0].innerHTML == 'Response') table.rows[table.rows.length-1].remove()
  if (table.rows.length > 2) {
    table.rows[table.rows.length-1].remove();
  }
}
function swapTrueFalse(item) {
  if(item.target) {
    item = item.target;
    if (item.innerText == 'true'){
      item.innerText = 'false';
    } else {
      item.innerText = 'true';
    }
  } else {
    if (item.innerText == 'false'){
      item.innerText = 'true';
    } else {
      item.innerText = 'false';
    }
  }
}
function swapRole(item,order) {
  if(item.target) {
    item = item.target;
    if (item.innerText == 'user'){
      item.innerText = 'system';
    } else if (item.innerText == 'system') {
      item.innerText = 'assistant';
    } else {
      item.innerText = 'user';
    }
  } else {
    if (item.innerText == 'user'){
      item.innerText = 'assistant';
    } else if (item.innerText == 'assistant' && order == 'first'){
      item.innerText = 'system';
    } else {
      item.innerText = 'user';
    }
  }
}
function historyFilterLimit(filterText) {
  socket.emit('historyFilterLimit',filterText);
  socket.emit('tab','History');
}
function connectButton() {
  let temp = document.getElementById('player-name').value
  document.getElementById('player-name').value = temp.trim().replace(/[^a-zA-Z0-9]/g,'');
  if (document.getElementById('connectButton').innerText == 'Connect'){
    playerName = document.getElementById('player-name').value;
    socket.auth = { playerName };
    socket.connect();
  } else if (document.getElementById('player-name').disabled && document.getElementById('connectButton').innerText == 'Change') {
    document.getElementById('player-name').disabled = false;
    document.getElementById('connectButton').innerText = 'Suggest';
  } else {
    socket.emit("changeName",document.getElementById('player-name').value);
  }
}
function disconnectButton() {
  socket.disconnect();
}
function historySearch(e){
  if (e.key === 'Enter' || e.keyCode === 13) {
    socket.emit("historyTextSearch",document.getElementById('history_search').value);
    document.getElementById('history_search_sent').value = document.getElementById('history_search').value;
    socket.emit('tab','History');
  }
}
function scotAdd(){
  let table = document.getElementById('scotMessages');
  let newrow = document.createElement('tr');
  newrow.innerHTML = '<th onclick="swapRole(this)" style="cursor: pointer;">user</th><td><textarea oninput="autoResize(this)"></textarea></td>';
  table.append(newrow);
}
function scotRemove(){
  let table = document.getElementById('scotMessages');
  if (table.rows.length > 1) {
    table.rows[table.rows.length-1].remove();
  }
}
function ScotRun(){
  let messages = [], table = document.getElementById('scotMessages');
  for (var i = 0, row; row = table.rows[i]; i++) {
    if (row.cells[0].innerText == 'system' || row.cells[0].innerText == 'user' || row.cells[0].innerText == 'assistant') {
      messages.push({
        role:row.cells[0].innerText,
        content:row.cells[1].firstChild.value
      })
    }
  }
  let ScotData = {
    temperature:document.getElementById('temperatureScot').value,
    maxTokens:document.getElementById('maxTokensScot').value,
    model:document.getElementById('modelScot').value,
    messages:messages
  }
  socket.emit("scotRun",ScotData);
  localStorage.setItem('temperatureScot',ScotData.temperature);
  localStorage.setItem('maxTokensScot',ScotData.maxTokens);
  localStorage.setItem('modelScot',ScotData.model);
  document.getElementById('response-messageScot').value = "";
}
function showTab(elmnt) {
  let pageName = elmnt.id.substring(0,elmnt.id.length-3)
  let tabcontent = document.getElementsByClassName("tabcontent");
  //hide all content
  for (let i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  //reset color
  let tablinks = document.getElementsByClassName("tablink");
  for (let i = 0; i < tablinks.length; i++) {
    tablinks[i].style.backgroundColor = "";
  }
  //show the right page
  document.getElementById(pageName).style.display = "block";
  //set tab color
  let colors = {
    HomeBtn:'green',
    CharactersBtn:'blue',
    AdventuresBtn:'orange',
    SystemBtn:'red',
    HistoryBtn:'#008080',
    ScotGPTBtn:'#008080'
  }
  elmnt.style.backgroundColor = colors[elmnt.id];
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
  const markdownParser = new MarkdownParser();
  const adventureHistoryDiv = document.getElementById('adventure-history');
  let messageDiv = document.getElementById('loading');
  if (!messageDiv){
    messageDiv = document.createElement('div');
  }
  messageDiv.className = 'message ' + (entry.role === 'user' ? 'player-message' : 'dm-message');
  if (entry.role === 'user') {
    messageDiv.textContent = entry.content;
  } else {
    messageDiv.innerHTML = markdownParser.parse(entry.content);
  }
  
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
  entry.ondblclick=function () {adventurerClick(this);};

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
    }
    button.textContent = 'x';

  entry.appendChild(button);
  list.appendChild(entry);
}
function AdventureInputRoll() {
  let characterDivs = document.getElementById('mySidepanel').getElementsByClassName('sidepanel-item');
  let diceSides = document.getElementById("player-input-roll-diceSides").value;
  let diceCount = document.getElementById("player-input-roll-diceCount").value;
  if (diceSides > 1 && diceCount > 0){
    let rolls = Array.from(characterDivs).map(div => {
      let nameDiv = div.querySelector('div:nth-child(1)');
      let name=nameDiv.textContent.replace('Name: ', '');
      let rollSum = 0
      for(let i = 0; i < diceCount; i++) {
        let roll = Math.floor(Math.random() * diceSides) + 1;
        while (testers.includes(name) && roll < (basecut*diceSides)){roll= Math.floor(Math.random() * diceSides) + 1};
        rollSum = rollSum + roll;
      }
      if (document.getElementById('player-input-field').value != "") {
        document.getElementById('player-input-field').value = document.getElementById('player-input-field').value+"\n"
      }
      document.getElementById('player-input-field').value = document.getElementById('player-input-field').value+name+" rolled "+diceCount+"d"+diceSides+" for "+rollSum;
      return {name:name,roll:rollSum};
    });
  }
}
function editAdventureInput() {
  document.getElementById('player-input-field').disabled = false;
  document.getElementById('adventureAction').innerText = 'Suggest';
  document.getElementById('player-input-edit').hidden = true;
}
function endAdventure() {
  socket.emit('endAdventure',document.getElementById('adventure_list').value);
  document.getElementById('HomeBtn').click();
}
function adventureModel(model) {
  if (document.getElementById('player-input-end').disabled == false) {
    socket.emit("setAdventureModel",{model:model,adventure_id:document.getElementById('adventure_list').value});
  }
}
function adventureRealm(realm) {
  if (document.getElementById('player-input-end').disabled == false) {
    socket.emit("setAdventureRealm",{realm:realm,adventure_id:document.getElementById('adventure_list').value});
  }
}
function adventureAction() {
  if (document.getElementById('adventureAction').innerText == 'Suggest') {
    var playerInput = document.getElementById('player-input-field').value.trim();
    if (playerInput.length > 1) {
      socket.emit('suggestAdventureInput',{role:'user',content:playerInput,adventure_id:document.getElementById('adventure_list').value});
      document.getElementById('player-input-field').disabled = true;
      document.getElementById('player-input-edit').hidden = false;
      document.getElementById('adventureAction').innerText = 'Approve';
    }
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
  let Classes = ["Barbarian","Bard","Cleric","Druid","Fighter","Monk","Paladin","Ranger","Rogue","Sorcerer","Warlock","Wizard","Assassin"];
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
    let attributeValue = rollStat();
    if (raceBonuses[selectedRace][attributes[i]]) {
      attributeValue += raceBonuses[selectedRace][attributes[i]];
    }
    document.getElementById('character_'+attributes[i]).value = attributeValue;
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
class MarkdownParser {
  constructor() {
    // Regular expressions for different markdown elements
    this.rules = {
      // Headers (h1 to h6)
      headers: /^(#{1,6})\s(.+)$/gm,
      
      // Bold text
      bold: /\*\*(.+?)\*\*/g,
      
      // Italic text
      italic: /\*(.+?)\*/g,
      
      // Code blocks with language specification
      codeBlock: /```(\w+)?\n([\s\S]*?)```/g,
      
      // Inline code
      inlineCode: /`(.+?)`/g,
      
      // Blockquotes
      blockquote: /^>\s(.+)$/gm,
    };
  }

  parse(markdown) {
    let html = markdown;

    // remove double line breaks
    html = html.replace(/\n\n/g, '\n');

    // Process code blocks first to prevent interference with other rules
    html = html.replace(this.rules.codeBlock, (match, language, code) => {
      return `<pre class="code-block ${language || ''}"><code>${this.escapeHTML(code.trim())}</code></pre>`;
    });

    // Process inline code
    html = html.replace(this.rules.inlineCode, '<code>$1</code>');

    // Process headers
    html = html.replace(this.rules.headers, (match, hLevel, text) => {
      const level = hLevel.length;
      return `<h${level}>${text.trim()}</h${level}>`;
    });

    // Process bold text
    html = html.replace(this.rules.bold, '<strong>$1</strong>');

    // Process italic text
    html = html.replace(this.rules.italic, '<em>$1</em>');

    // Process blockquotes
    html = html.replace(this.rules.blockquote, '<blockquote>$1</blockquote>');

    // Process links
    html = html.replace(this.rules.links, '<a href="$2">$1</a>');

    return html;
  }

  // Helper function to escape HTML special characters
  escapeHTML(text) {
    const escapeChars = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, char => escapeChars[char]);
  }
}