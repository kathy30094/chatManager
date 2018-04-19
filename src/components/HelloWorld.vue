<template>
  <div class="hello">
    <div id="container">

      <div id="status-box">
          Server: 
          <span id="status">{{status}}</span> / <span id="online">{{peopleOnline}}</span> online.
      </div>
      <div class="side-nav">
        <!-- //////////////////////////////////////////待改 -->
        <!-- <h2>加入房間</h2>
        <div id='join room'>
          <br>
          <label>roomA</label> <input type="checkbox" value="roomA" v-model="roomJoin">
          <br>
          <label>roomB</label> <input type="checkbox" value="roomB" v-model="roomJoin">
          <br>
          <label>roomC</label> <input type="checkbox" value="roomC" v-model="roomJoin">
          <br>
          <button type='button' @click="join">加入</button>
        </div>
        <br>
        <br> -->

        <h2>選擇聊天對象</h2>
        <div id='chose to-say'>
          <table>
            <tr v-for="(room) in roomList">
              <td>{{room}}</td>
              <td><input type="radio" v-model="chatData.chatSelect" :value='room' name="chose"/></td>
            </tr>
            <!-- <tr>
              <td><label>{{roomBelong}}</label></td>
              <td><input type="radio" v-model="chatData.chatSelect" :value='roomBelong' name="chose"/></td>
            </tr> -->

            <tr v-for="(memberAcc) in memberList">
              <td>{{memberAcc}}</td>
              <td><input type="radio" v-model="chatData.chatSelect" :value='memberAcc' name="chose"/></td>
            </tr>
          </table>
          <button type='button' @click="kick">Kick</button>
        </div>
      </div>
      
      <div class="chatroom">
         <h2>開始聊天</h2>
        <ul class="chat-box">
          <li v-for="msg in msgs">
            {{msg}}
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
      roomJoin: [],
      peopleOnline: '',
      status: '',
      msgs: [],
      memberList: [],
      roomList: [],
      roomBelong: '',
    };
  },
  methods: {
    
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
        msg: ' ( 公告 ) : '+this.chatData.msg,
        token: localStorage.token,
        chatSelect: this.chatData.chatSelect,
        TimeOut: 1800,
      };
      //this.$socket.emit('say',announceData);
      this.$socket.emit('announce',announceData);
      
    },

    //////////////////////////待改
    // join()
    // {
      //   let joinData = {
      //     token: localStorage.token,
          
      //     roomids: this.roomJoin,
      //   };
      //   this.$socket.emit('join', joinData);
      //   console.log('joined');
    // },
  },

  sockets: {
    membersInRoom(data)
    {
      console.log(data.roomName+' : '+data.members);
      if(data.roomName == localStorage.roomBelong)
      {
        this.memberList = data.members;
        this.peopleOnline = data.members.length;
      }
    },
    allRooms(data)
    {
      this.roomList = data;
      console.log(data);
    },

    connect()
    {
      this.status = 'Connceted';
      this.$socket.emit('isOnline',localStorage.token);
    },
    
    notLogined()
    {
      alert('請先登入！');
      window.location.href = 'http://192.168.4.114:8080';
    },

    showSelfMsg(memberMsg)
    {
      localStorage.setItem('Account',memberMsg.Acc);
      this.Acc = memberMsg.Acc;
      localStorage.setItem('roomBelong', memberMsg.roomBelong);
      this.roomBelong = memberMsg.roomBelong;
      this.chatData.chatSelect = memberMsg.roomBelong;
    },

    // showAllMember(memberOnlineArray)
    // {
    //   this.memberList = memberOnlineArray;
    //   this.peopleOnline = memberOnlineArray.length;
    // },
    
    message(msg)
    {
      switch(msg.event)
      {
        case 'join':
          console.log(msg.data.Acc+" join in room "+msg.data.roomid);
          this.msgs.push(msg.data.Acc+" join in room "+msg.data.roomid);
          break;
        case 'say':
          console.log(msg.data.Acc+" --> " + msg.data.chatSelect+' : '+msg.data.msg);
          this.msgs.push(msg.data.Acc+" --> " + msg.data.chatSelect+' : '+msg.data.msg);
          break;
        case 'getAnnounce':
          msg.data.forEach(announce => {
            this.msgs.push(announce);
            console.log(announce);
          });
          break;
      };
      var chatbox = document.getElementsByClassName('chat-box');
      setTimeout(() => {
        chatbox[0].scrollTop = 9999999;
      }, 0);
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
    console.log(typeof theToken);
  }
}

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style>
  html, body, #app, .hello, #container {
    height: 100%;
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
    height: 85%;
    padding-left: 0;
    overflow: auto;
 
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
  
</style>
