<template>
  <div class="hello">
    <div id="container">
      <div id="status-box">
          Server: 
          <span id="status">{{status}}</span> / <span id="online">{{onlineCount}}</span> online.
      </div>
      <div class="side-nav">
        <h4>加入房間</h4>
        <div id='join-room'>
          <input v-model="roomName" name="joinRoom" id="room-input" placeholder="Room to join ..." @keyup.13="joinRoom">
          <br>
          <div class="side-right">
            <button type='button' @click="joinRoom">加入</button>
            <button type='button' @click="leaveRoom">離開</button>
          </div>
        </div>

        <h4>被邀請的房間</h4>
        <div id='invited-room'>
          <table>
            <tr v-for="(roomInvited) in roomInvitedList">
              <td>{{roomInvited.roomName}}</td>
              <td><button type='button' @click="inviteResponse('accept',roomInvited.roomName)">加入</button></td>
              <td><button type='button' @click="inviteResponse('reject',roomInvited.roomName)">拒絕</button></td>
            </tr>
          </table>
        </div>

        <b-modal id="myModal" @ok="inviteToRoom">
          請選擇要邀請的人 :
          <br>
          <b-form-checkbox-group stacked v-model="checkedNames" name="flavour2" :options="memberOption">
          </b-form-checkbox-group>
        </b-modal>

        <h4>選擇聊天對象</h4>
        <div id='chose-to-say'>
          <table>
            <tr v-for="(room) in roomList">
                <td><label :for="room">{{room}}</label></td>
                <label :for="room"><input type="radio" v-model="chatData.chatSelect" :id="room" :value='room' name="chose"/></label>
            </tr>

            <tr v-for="(memberAcc) in memberList">
                <td><label :for="memberAcc">{{memberAcc}}</label></td>
                <label :for="memberAcc"><input type="radio" v-model="chatData.chatSelect" :id="memberAcc" :value="memberAcc" name="chose"/></label>
            </tr>
          </table>
          <div class="side-right">
            <button type='button' @click="kick">Kick</button>
          </div>
        </div>
      </div>
      
      <div class="chatroom">
        <h4>已加入的房間</h4>
        <div id='room-joined'>
          <table>
            <tr v-for="(roomJoined) in roomJoinedList">
              <td>{{roomJoined}}</td>
              <td><button v-b-modal.myModal @click="roomInvite=roomJoined; checkedNames=[]; memberNotIn();" type='button'>invite</button></td>
            </tr>
          </table>
        </div>

        <h4>開始聊天</h4>
        <ul class="chat-box">
          <li v-for="msg in msgs">
            {{msg.msg}}
            <div v-if="msg.urlResult!=null">
              <div v-if="msg.urlResult.success==true">
              <a :href="msg.urlResult.requestUrl">{{msg.urlResult.data.ogTitle}}</a>

              <div v-if="msg.urlResult.data.ogVideo">
                <iframe width="384" height="216" :src="msg.urlResult.data.ogVideo.url" allowfullscreen></iframe>
              </div>

              <div v-else-if="msg.urlResult.data.ogImage && !Array.isArray(msg.urlResult.data.ogImage)">
                <a :href="msg.urlResult.requestUrl"><img :src="msg.urlResult.data.ogImage.url" width="100" height="100"></a>
              </div>
            </div>
            </div>
          </li>
        </ul>
        <div id="send-form">
          <span id="Acc">{{Acc}} </span>
          <span class="dot">: </span>
          <input v-model="chatData.msg" name="msg" id="msg" placeholder="說點什麼？" @keyup.13="say">
          <button type='button' @click="say">送出</button>
          <button type='button' @click="announce">發公告</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data(){
    return{
      chatData: {
        msg: '',
        chatSelect: this.roomBelong,
      },
      Acc:'',
      roomName: '',
      onlineCount: '',
      status: '',
      msgs: [],
      memberList: [],
      roomJoinedList: [],
      roomInvitedList: [],
      roomList: [],
      memberOption: [],
      checkedNames: [],
      roomBelong: '',
      roomInvite: '',
    };
  },
  methods: {
    memberNotIn()
    {
      let allMember = JSON.parse(sessionStorage[this.roomBelong+':all']);
      let alreadyInRoom = JSON.parse(sessionStorage[this.roomInvite+':all']);

      let diff = allMember.filter(n => alreadyInRoom.indexOf(n) == -1);

      this.memberOption = [];

      for(let member of diff)
        this.memberOption.push({text: member,value: member});

    },

    inviteResponse(theChose,room)
    {
      let responseData = {
        chose: theChose,
        token: localStorage.token,
        roomName: room,
      };
      this.$socket.emit('inviteResponse',responseData);
    },

    inviteToRoom()
    {
      let inviteData = {
        roomTo: this.roomInvite,
        members: this.checkedNames,
        token: localStorage.token,
      };
      this.$socket.emit('inviteToRoom',inviteData)
    },

    kick()
    {
      let kick = {
        toKick: this.chatData.chatSelect,
        token: localStorage.token,
      };
      this.$socket.emit('kick',kick);
    },

    isOnline()
    {
      this.$socket.emit('isOnline',localStorage.token);
    },

    say()
    {
      let chatData = {
        msg: this.chatData.msg,
        token: localStorage.token,
        chatSelect: this.chatData.chatSelect,
      };
      this.$socket.emit('say', chatData);
    },
    
    announce()
    {
      let announceData = {
        msg: ' ( 公告 ) '+this.chatData.msg,
        token: localStorage.token,
        chatSelect: this.chatData.chatSelect,
        TimeOut: 1800,
      };
      this.$socket.emit('announce',announceData);
      
    },

    leaveRoom()
    {
      let leaveData = {
        token: localStorage.token,
        roomName: this.roomName,
      };
      this.$socket.emit('leaveRoom',leaveData);
      console.log('leave '+this.roomName);
    },

    joinRoom()
    {
      let joinData = {
        token: localStorage.token,
        roomName: this.roomName,
      };
      this.$socket.emit('joinRoom', joinData);
      console.log('join '+this.roomName);
    },
  },

  sockets: {

    message(msg)
    {
      switch(msg.event)
      {
        case 'join':
          console.log(msg.data.Acc+" join in room "+msg.data.roomid);
          this.msgs.push({msg: msg.data.Acc+" join in room "+msg.data.roomid});
          break;
        case 'say':
          console.log(msg.data.Acc+" --> " + msg.data.chatSelect+' : '+msg.data.msg);
          this.msgs.push({msg: msg.data.Acc+" --> " + msg.data.chatSelect+' : '+msg.data.msg,urlResult: msg.data.urlResult});
          break;
        case 'getAnnounce':
          msg.data.forEach(announce => {
            this.msgs.push({msg: announce});
            console.log(announce);
          });
          break;
      };
      var chatbox = document.getElementsByClassName('chat-box');
      setTimeout(() => {
        chatbox[0].scrollTop = 9999999;
      }, 0);
    },

    acceptJoin(responseData)
    {
      this.$socket.emit('joinRoom',responseData);
      console.log(responseData);
    },

    beInvited(inviteReqs)
    {
      this.roomInvitedList = inviteReqs;
    },

    membersInRoom(data)
    {
      console.log(data.roomName+' : '+data.members);
      if(data.roomName == sessionStorage.roomBelong)
      {
        this.memberList = data.members;
        this.onlineCount = data.members.length;
      }
      else if (data.roomName.slice(-4)==':all')
      {
        sessionStorage[data.roomName]=JSON.stringify(data.members);
      }
    },
    allRooms(data)
    {
      this.roomList = data;
      console.log(data);
    },

    roomJoined(roomJoinedList)
    {
      this.roomJoinedList = roomJoinedList;
    },

    connect()
    {
      this.status = 'Connceted';
      this.$socket.emit('isOnline',localStorage.token);
      console.log(localStorage['token']);
    },
    
    notLogined()
    {
      alert('請先登入！');
      window.location.href = 'http://192.168.4.114:8080';
    },

    showSelfMsg(memberMsg)
    {
      sessionStorage.setItem('Account',memberMsg.Acc);
      this.Acc = memberMsg.Acc;
      this.roomBelong = memberMsg.roomBelong+'_:'+memberMsg.roomBelong;
      sessionStorage.setItem('roomBelong', this.roomBelong);
      this.chatData.chatSelect = this.roomBelong;
    },

    disconnect(){
      this.status = 'disConnceted';
    },
  },

  mounted() {
    var theToken = window.name;
    /////////////////////////////////////////////////////////待改    firefox 無痕視窗會有問題
    if(localStorage.token == null || theToken)
      localStorage.setItem('token',theToken);
    window.name = '';
    console.log(typeof theToken);

      let a = [2,3,4,5,6];
      
      let b = [5,6];
      // diff = a.filter(function(v){return b.includes(v)});
      let diff = a.filter(n => b.includes(n));
      console.log(diff);
  }
}

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style>
  html, body, #app, .hello, #container {
    height: 100%;
  }

  h4{
    clear: both;
  }

  #container {
    width: 80%;
    height: 90%;
  }

  .side-nav {
    display: inline-block;
    width: 30%;
    border-right: 3px solid rgb(177, 177, 177);
    height: 88%;
    overflow: auto;
  }

  .chatroom {
    display: inline-block;
    width: 65%;
    padding-left: 2%;
    height: 88%;
    margin-top: 0;
    position: absolute;
  }

  .chat-box {
    height: 65%;
    padding-left: 0;
    overflow: auto;
  }

  .side-right {
    float: right;
    margin-right: -4px;
  }

  li {
    list-style-type: none;
    padding-bottom: 8px;
  }

  #send-form {
    width: 100%;
  }

  #msg {
    width: 66%;
  }
  
  span#Acc {
    display: inline-block;
    width: 10%;
  }

  #join-room{
    width: 70%;
  }
  #chose-to-say{
    width: 70%;
  }

  #room-input {
    width: 100%;
  }

  #room-joined{
    height: 20%;
    overflow: auto;
  }

  #invited-room
  {
    height: 15%;
    overflow: auto;
  }
  
</style>
