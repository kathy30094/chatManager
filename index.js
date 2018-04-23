const express = require('express');
const app = express();

app.use(express.static(__dirname + '/dist'));
app.get('/', function(req, res){
  res.sendfile('index.html');
});

const server = require('http').Server(app);
const io = require('socket.io')(server);

const _ = require('underscore');

const mysql = require('mysql2/promise');
const mysqlConnectionData = {
    host    : 'localhost',
    user    : 'saaa',
    password: 'dk3u31j4dk3u3',
    database: 'company'
};

//async-redis settings
    const asyncRedis = require("async-redis");

    const redisClient_token = asyncRedis.createClient();
    redisClient_token.select(0);

    const redisClient_onlineAcc = asyncRedis.createClient();
    redisClient_onlineAcc.select(2);

    const redisClient_onlineSocket = asyncRedis.createClient();
    redisClient_onlineSocket.select(3);

    const redisClient_room = asyncRedis.createClient();
    redisClient_room.select(4);

    const redisClient_announce = asyncRedis.createClient();
    redisClient_announce.select(5);

//end   async-redis settings

//redisAdapter
    const redis = require('redis');
    const redisAdapter  = require('socket.io-redis');
    const pub = redis.createClient();
    const sub = redis.createClient();
    io.adapter(redisAdapter({pubClient: pub, subClient: sub}));

    pub.on('ready',function(err){
        console.log('redis ready');
    });
//end redisAdapter

var memberdata = {};
var memberSockets = [];
var membersInRoom = [];

io.on('connection', (socket) => {

    console.log('Hello!');  // 顯示 Hello!
    
    async function authAndGetAcc(token)
    {
        var res = await redisClient_token.get(token);
        //console.log("res :    "+res);

        if(res != null)
        {
            data = JSON.parse(res);
            console.log(res);
            return data;
        }
        else
        {
            memberdata = {};
            socket.emit('notLogined');
        }
    };
    
    async function getAnnounce(roomBelong)
    {
        
        announceList = await redisClient_announce.keys(roomBelong+':*');
        console.log('get announce from '+ roomBelong );
        deAnnounceList = [];
        
        if(announceList)
        {
            announceList.forEach(announce => {
                deAnnounceList.push(decodeURIComponent(announce));
            });
            console.log(roomBelong+'  announceList : '+deAnnounceList);
            socket.emit('message',{"event":'getAnnounce', "data": deAnnounceList});
        }
            
    }

    async function romSaveJoinEmit(roomBelong, toJoin, Acc, socketid)
    {
        roomToJoin = toJoin+':current';
        io.of('/').adapter.remoteJoin(socketid, toJoin, (err) => {
            if (err) { console.log('join error'); }
            console.log('join success');
          });

        membersInRoomRedis = null;
        membersInRoom = [];
        //加入redis房間  .set(roomXXXX, [member array])
        membersInRoomRedis = await redisClient_room.get(roomToJoin);

        if(membersInRoomRedis != null)
        {
            membersInRoom = JSON.parse(membersInRoomRedis);
            
            if(membersInRoom.indexOf(Acc) == -1)
            {
                membersInRoom.push(Acc);
                await redisClient_room.set(roomToJoin, JSON.stringify(membersInRoom));
                console.log("member in "+roomToJoin + " : "+ membersInRoom);
            }
            else
                console.log('member '+Acc+' already in '+roomToJoin);
        }
        else
        {
            membersInRoom.push(Acc);
            await redisClient_room.set(roomToJoin, JSON.stringify(membersInRoom));
            console.log("member in "+roomToJoin + " : "+ membersInRoom+"    new room");
        }

        //向 room內所有其他人 & roomAgentX_:Agent 更新room內人員名單
        if(roomToJoin == roomBelong+'_:'+roomBelong)
            io.in(roomBelong+'_:Agent').emit('membersInRoom',{'roomName': toJoin,'members': membersInRoom});
        else
            io.in(toJoin).emit('membersInRoom',{'roomName': toJoin,'members': membersInRoom});
    
        //進入房間後，接著拿取房間的公告
        await getAnnounce(toJoin);

    }

    

    socket.on('joinRoom', async (joinData) => {

        memberdata = await authAndGetAcc(joinData.token);

        roomName = memberdata.roomBelong+'_:'+joinData.roomName

        //新增mysql內容  roomName / Acc
        const mysqlConnection = await mysql.createConnection(mysqlConnectionData);
        await mysqlConnection.execute('INSERT INTO `roomData`(`roomName`, `member`) VALUES (?,?)',[roomName, memberdata.Account]);
        
        //roomAgentX_:roomName:all 更新
        roomMember = JSON.parse(await redisClient_room.get(roomName+':all'));

        //新room，新增
        if(roomMember == null)
        {
            io.in()
            console.log(1);
            await redisClient_room.set(roomName+':all',JSON.stringify([memberdata.Account]));
        }
        //已經有這個房間，更新
        else
        {
            roomMember.push(memberdata.Account);
            await redisClient_room.set(roomName+':all',JSON.stringify(roomMember));
            console.log(2);
        }

        memberSockets = JSON.parse(await redisClient_onlineAcc.get(memberdata.Account)).socketid;
        console.log(memberSockets);

        for(var socketid of memberSockets)
        {
            console.log(socketid);
            await romSaveJoinEmit(memberdata.roomBelong, roomName, memberdata.Account, socketid);
        }

        //對Agent & room成員 更新存在的房間清單
        var roomList = await redisClient_room.keys(memberdata.roomBelong+'*');
        var roomToShow = [];
        roomList.forEach(element => {
            if(element.slice(-4)==':all')
                roomToShow.push(element.slice(0,-4));
        });

        io.in(roomName).emit('allRooms',roomToShow);
        io.in(memberdata.roomBelong+'_:Agent').emit('allRooms',roomToShow);

    });

    socket.on('kick', async (kickData) => {

        memberdata = await authAndGetAcc(kickData.token);

        if(memberdata.Status == '0')
        {
            //檢查被kick的人狀態，如果是Agent則無法被kick
            AccToken = JSON.parse(await redisClient_onlineAcc.get(kickData.toKick)).token;
            status = JSON.parse(await redisClient_token.get(AccToken[0])).Status;
            if(status==1) //Player
            {
                AccToken.forEach(eachToken => {
                    redisClient_token.del(eachToken);
                });

                //給對象
                var socketsIdToKick = JSON.parse(await redisClient_onlineAcc.get(kickData.toKick));
                socketsIdToKick.socketid.forEach(socketIdto => {
                    socket.to(socketIdto).emit('kickOut');
                    console.log(socketIdto+ ' logout !');
                });
            } 
        }
    });

    socket.on('announce', async (announceData) => {

        //檢查是否登入
        memberdata = await authAndGetAcc(announceData.token);
        console.log('memberdata.Acc ; '+memberdata.Account);

        //檢查是否為agent
        if(memberdata.Status == '0')
        {
            var rooms = await redisClient_room.keys('*');

            console.log(announceData.chatSelect +'   :   '+memberdata.roomBelong);
            if(rooms.includes(announceData.chatSelect+':all'))//redis清單內有這個room
            {
                if(typeof socket.adapter.rooms[announceData.chatSelect]!='undefined')
                {
                    //找到已經在room裡的成員
                    var peopleInRoom=Object.keys(socket.adapter.rooms[announceData.chatSelect].sockets);

                    //檢查自己有沒有在裡面
                    if(peopleInRoom.includes(socket.id))
                    {
                        //存入redis //room name to be key
                        console.log(announceData.msg);
                        await redisClient_announce.set(announceData.chatSelect+':'+encodeURIComponent(announceData.msg),JSON.stringify(announceData));
                        await redisClient_announce.expire(announceData.chatSelect+':'+encodeURIComponent(announceData.msg),announceData.TimeOut);
                    }
                    
                }
                //增加Agent特權，應可對roomAgentX內的所有room發公告
                else if (announceData.chatSelect.indexOf(memberdata.roomBelong)!=-1) 
                {
                    //存入redis //room name to be key
                    console.log(announceData.msg);
                    await redisClient_announce.set(announceData.chatSelect+':'+encodeURIComponent(announceData.msg),JSON.stringify(announceData));
                    await redisClient_announce.expire(announceData.chatSelect+':'+encodeURIComponent(announceData.msg),announceData.TimeOut);
                }
            }
            console.log('announceData.chatSelect + announceData.msg  :  '+announceData.chatSelect+':'+announceData.msg)
            //配發給room內的成員 & self
            io.to(announceData.chatSelect).emit('message',{"event":'getAnnounce', "data": [announceData.chatSelect+':'+announceData.msg]});
            
        }
    });

    //一登入就進來登記
    socket.on('isOnline',async (token) => {
        
        console.log(token);
        memberdata = await authAndGetAcc(token);

        let memberMsg = {
            Acc: memberdata.Account,
            roomBelong: memberdata.roomBelong,
        };
        socket.emit('showSelfMsg',memberMsg);

        //加入自己屬於的房間
        rooms = JSON.parse(await redisClient_onlineAcc.get('roomData:'+memberdata.Account));
        for(let room of rooms)
            await romSaveJoinEmit(memberdata.roomBelong, room, memberdata.Account, socket.id);

        //對自己  更新存在的房間清單
        var roomList = await redisClient_room.keys(memberdata.roomBelong+'*');
        var roomToShow = [];
        roomList.forEach(element => {
            if(element.slice(-4)==':all')
                roomToShow.push(element.slice(0,-4));
        });
        socket.emit('allRooms',roomToShow);

        //Acc 與 socketid & token 對照
        socketAndToken = await redisClient_onlineAcc.get(memberdata.Account);
        if(socketAndToken != null)
        {
            memberSockets = JSON.parse(socketAndToken).socketid;
            memberTokens = JSON.parse(socketAndToken).token;
        }
        else
        {
            memberSockets = [];
            memberTokens = [];
        }
        
        memberSockets.push(socket.id);
        if(!memberTokens.includes(token))
            memberTokens.push(token);

        let socketAndTokenToSave = {
            'socketid': memberSockets,
            'token' : memberTokens
        };

        console.log("Acc " + memberdata.Account+" SocketAndTokenToSave after push : "+JSON.stringify(socketAndTokenToSave));
        await redisClient_onlineAcc.set(memberdata.Account, JSON.stringify(socketAndTokenToSave));

        //socketid 與 Acc對照
        await redisClient_onlineSocket.set(socket.id, memberdata.Account);

        console.log("member Acc " + memberdata.Account+', member sockeet id '+ socket.id + " is online");
            
    });
    
    socket.on("say", async (chatData) => {

        memberdata = await authAndGetAcc(chatData.token);

        console.log("chatSelect : "+chatData.chatSelect);
        //ret
        var retData={
            Acc: memberdata.Account,
            msg: chatData.msg,
            chatSelect: chatData.chatSelect,  
        };

        //redis所有room清單
        var rooms = await redisClient_room.keys('*');

        //對room
        if(rooms.includes(chatData.chatSelect))//redis清單內有這個room
        {
            if(typeof socket.adapter.rooms[chatData.chatSelect]!='undefined')
            {
                //找到已經在room裡的成員
                var peopleInRoom=Object.keys(socket.adapter.rooms[chatData.chatSelect].sockets);

                //檢查自己有沒有在裡面
                if(peopleInRoom.includes(socket.id))
                    io.in(chatData.chatSelect).emit('message',{'event':'say', 'data': retData});
            }
            //增加Agent特權，應可對roomAgentX內的所有room講話
            else if (chatData.chatSelect.indexOf(memberdata.roomBelong)!=-1) 
            {
                //給room
                io.in(chatData.chatSelect).emit('message',{'event':'say', 'data': retData});

                //給自己   
                selfData = JSON.parse(await redisClient_onlineAcc.get(memberdata.Account));
                selfData.socketid.forEach(socketIdto => {
                    socket.to(socketIdto).emit('message',{'event':'say', 'data': retData});
                });
                socket.emit('message',{'event':'say', 'data': retData});
            }
        }
        //私聊
        else
        {
            //給自己 
            selfData = JSON.parse(await redisClient_onlineAcc.get(memberdata.Account));
            selfData.socketid.forEach(socketIdto => {
                socket.to(socketIdto).emit('message',{'event':'say', 'data': retData});
            });
            socket.emit('message',{'event':'say', 'data': retData});

            //給對象
            var socketsIdChatTo = JSON.parse(await redisClient_onlineAcc.get(chatData.chatSelect));
            socketsIdChatTo.socketid.forEach(socketIdto => {
                socket.to(socketIdto).emit('message',{'event':'say', 'data': retData});
            });
        }
    });

    // 有人離線了
    socket.on('disconnect', async () => {

        //查詢Acc後，刪除 socketid對照
        var AccLeave = await redisClient_onlineSocket.get(socket.id);
        await redisClient_onlineSocket.del(socket.id);

        //有登入，儲存過socket id 到 redis
        if(AccLeave != null)
        {
            socketAndToken = JSON.parse(await redisClient_onlineAcc.get(AccLeave));
            console.log('socketAndToken.socketid.length : '+socketAndToken.socketid.length);

            //如果 某Acc 關閉最後一個分頁，要把Acc從上線中的名單移除，也從各個room中移除
            if(socketAndToken.socketid.length <= 1)
            {
                //從上線名單中移除
                await redisClient_onlineAcc.del(AccLeave);
                console.log(AccLeave+' leave all chat');

                //找出所有Acc加入的room，去每個房間裡看
                allRooms = JSON.parse(await redisClient_onlineAcc.get('roomData:'+AccLeave));
                for(let i = 0;i<allRooms.length;i++)
                {
                    membersInRoom = JSON.parse(await redisClient_room.get(allRooms[i]+':current'));

                    //移除
                    membersInRoom.splice(membersInRoom.indexOf(AccLeave),1);
                    
                     //如果room內沒人，刪除room
                    if(membersInRoom.length==0)
                        await redisClient_room.del(allRooms[i]+':current'); //如果移除了Acc之後，room裡面就沒人了，刪除沒人的room

                    //room內還有人，向room內所有人更新room內人員名單
                    else
                    {
                        await redisClient_room.set(allRooms[i]+':current', JSON.stringify(membersInRoom));
                        io.in(allRooms[i]).emit('membersInRoom',{'roomName': allRooms[i],'members': membersInRoom});
                    }

                    console.log('member in room '+allRooms[i]+' :  '+membersInRoom);
                }
            }
            else  //拿掉指定的socketid from array
            {
                socketAndToken.socketid = _.without(socketAndToken.socketid, socket.id);

                await redisClient_onlineAcc.set(AccLeave, JSON.stringify(socketAndToken));
                console.log(AccLeave+" socket left : "+ JSON.stringify(socketAndToken));
            }
        }
    });
});

server.listen(10001, async (req, res) => {
    console.log("server started. http://localhost:10001");
    //清空redis
    redisClient_onlineSocket.flushdb();
    redisClient_onlineAcc.flushdb();
    await redisClient_room.flushdb();
    console.log('flushdb');
    
    //從MySQL拿房間資料
    const mysqlConnection = await mysql.createConnection(mysqlConnectionData);
    [rows,fields] = await mysqlConnection.execute('SELECT roomName,member FROM roomData');
    
    var roomList = {};
    rows.forEach(row => {
        if(roomList.hasOwnProperty(row.roomName))
            roomList[row.roomName].push(row.member);
        else
            roomList[row.roomName] = [row.member]
        //console.log(row.roomName+' : '+roomList[row.roomName]);
    });
    for(let element in roomList){
        console.log(element +"   "+ roomList[element]);
        await redisClient_room.set(element+':all',JSON.stringify(roomList[element]));
    }

    var member_room = {};
    rows.forEach(row => {
        if(member_room.hasOwnProperty(row.member))
            member_room[row.member].push(row.roomName);
        else
            member_room[row.member] = [row.roomName]
    });
    for(let element in member_room){
        console.log(element +"   "+ member_room[element]);
        await redisClient_onlineAcc.set('roomData:'+element,JSON.stringify(member_room[element]));
    }
});
